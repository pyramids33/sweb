
# $web
### Micro-payment Web Server

https://sweb.lol

Deno 1.29.3

## Sweb Server
Use Sweb Server to:
- Serve your static website.
- Require visitors to pay for access to URLs, according to your configuration.
- Provides a convenient HTTP API to publish content and retrieve data.

Payments are made using the BSV blockchain network.  
See https://bitcoinassociation.net/

### Setup Guide 

#### 1. Install Deno  
See https://deno.land/ for details

#### 2. Install Sweb Code
Download the sweb source code.    
```
git clone https://github.com/pyramids33/sweb ./swebsrc 
```

#### 3. Make a directory for your site
```
mkdir <sitePath>
```

#### 4. Point domain to your server ip
Add dns A record to point to the ip address of your server.  
Add dns TXT record containing dns code (generated by client).  

```
# on your local sitePath
> cd sitePath
sitePath> sweb show-dnscode
sitePath> abcdefgabcdefg....
```

#### 5. Get a domain certificate
You need a domain name to accept payments.  
Here is an example using certbot/nginx:    
```
sudo certbot certonly --nginx -d example.com
```

#### 6. Create a config file
```
// example.config.json
{
    // the listen options passed to oak.
    // if not using a reverse proxy, provide the cert and keyfile options
    "listenOptions": {
        "port": 42069,
        "hostname": "127.0.0.1"
    },
    
    // run workers on additional ports (put behind a reverse proxy and load balance)
    "workers": [ { port:42070 } ]

    // use strong random values for cookie signing
    "cookieSecret": [ "blah" ],
    
    // directory to store database and files
    "sitePath": "pathToSite/",

    // log http errors
    "logErrors": false,

    // creates the required subdirectories in sitePath
    "ensureDirs": true, 
    
    // set the authKey on startup - convenient but not recommended
    "initAuthKey": "hexstring" 
    
    // dev or prod - some features enabled on dev
    "env": "dev", 
    
    // optional dir of customer static files
    "staticPath": undefined,

    // your domain name
    "domain": "yourdomain.com",

    // mapi endpoints for tx broadcast
    "mAPIEndpoints": [{
        "name": "dev",
        "url": "http://swebsite.localdev:3001/dev/tx",
        "extraHeaders": { "Content-Type": "application/json" } 
    }]
}
```

#### 7. Run Sweb Server
Start the sweb server using your config file.  This can be done as a systemctl service for example. 
```
# allow-all unstable is required due to sqlite3 library

deno run --allow-all --unstable /pathToSwebSrc/server/main.ts /pathToConfigFile/example.config.json
```

#### 8. Nginx Reverse Proxy
Example nginx config for reverse proxy

```
server {
    listen 80;
    server_name example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name example.com;
    server_tokens off;
    ssl_certificate /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;

    client_max_body_size 50M;

    location /.protected/ {
        internal;
        alias   /sitePath;
    }

    location /.bip270/inv/sse {
        proxy_set_header    X-Forwarded-For $remote_addr;
        proxy_set_header    Host $http_host;
        proxy_pass          http://127.0.0.1:42069/.bip270/inv/sse;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_read_timeout 3600;
        proxy_buffering off;
        proxy_cache off;
    }
    location / {
        proxy_set_header   X-Forwarded-For $remote_addr;
        proxy_set_header   Host $http_host;
        proxy_pass         http://127.0.0.1:42069/;
    }
}

```

## Sweb Client (CLI)

Use sweb client to: 
- Configure your swebsite locally
- Publish to your sweb server
- Download and redeem payments

```
# Link command 
# allow-all unstable is required due to sqlite3 library

# deno install --allow-all --unstable -n sweb ./client/main.ts

Usage: sweb [options] [command]

Options:
  -h, --help                                                        display help for command

Commands:
  init [options]                                                    Create a new site database.
  set-config [options]                                              Set configuration options
  set-hdkey [options]                                               Generate a new hd key (bip32)
  add-paywall [options] <pattern> <amount> [description] [address]  add paywall
  remove-paywall [options] <pattern> <outputNum>                    remove paywall or paywall output
  reindex-files [options]                                           Reindex file information
  activate-authkey [options]                                        activate authKey on the server using the DNS txt record
  download-file [options] <urlPath>                                 download a file and pipe to stdout
  get-api-status [options]                                          ping the server to check online and authorized
  get-payments [options]                                            Download invoices from server
  get-fileinfo [options] <urlPath>                                  get info about a file
  publish [options]                                                 Sync files to server. (Local reindex, diff, then upload/delete/rename)
  upload-file <relativePath>                                        upload a file
  process-tx [options]                                              process a tx, marking outputs as spent. (the tx should have already
                                                                    been broadcast)
  redeem-funds [options]                                            create tx spending to address (tx hex is printed to stdout)
  show-balance [options]                                            show balance summary
  show-config [options]                                             show config from db
  show-diff [options]                                               show changes to the files
  show-dnscode [options]                                            prints the dns authorization code to be put in your domains dns TXT
                                                                    record
  show-files [options]                                              show site map by walking sitePath
  show-outputs [options]                                            show txoutputs
  show-payments [options]                                           show payments
  show-paywalls [options]                                           show the paywalls from paywall.json
  help [command]                                                    display help for command


```

#### 1. Example (first you need a server setup)
```
>mkdir sitePath
>cd sitePath

# initialise -- note down the mnemonic which is printed for key recovery
sitePath> sweb init --siteUrl https://example.com --authKey r

# show dnscode, then add the dns code to domain TXT record
sitePath> sweb show-dnscode

# activate authkey on server (it checks the dns TXT)
sitePath> sweb activate-authkey

# check you have site online and access with your authkey
sitePath> sweb get-api-status

# add some cool content
sitePath> nano ./myfiles/how_the_pros_do_it.html

# check the urls from your site
sitePath> sweb show-files --fs
sitePath> sweb reindex-files --local
sitePath> sweb show-files --db

# add paywall
sitePath> sweb add-paywall /myfiles 5000
sitePath> sweb show-paywalls

# publish
sitePath> sweb publish

# get payments from server (they are deleted from the server after downloading)
sitePath> sweb get-payments
sitePath> sweb show-balance

# transfer the funds to your main wallet
sitePath> sweb redeem-funds -b -p --address <bitcoinAddress>

# show payments details
sitePath> sweb show-payments
sitePath> sweb show-outputs