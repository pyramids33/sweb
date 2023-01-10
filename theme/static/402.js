var p = fetch('/.bip270/inv', {
    method: 'POST',
    headers:{ 'Content-Type': 'application/x-www-form-urlencoded' },    
    body: new URLSearchParams({ urlPath: window.location.pathname })
})
.then(res => res.json())
.then((data) => {
    if (data.error) {
        document.getElementById('error').textContent = data.error;
    } else {
        showInvoice(data);
    }
})
.catch((error) => {
    document.getElementById('error').textContent = 'An Error Occurred.';
    console.log(error);
});

function showInvoice (invoice) {
    console.log(invoice);
    
    window.devpay = function () {
        fetch('/.bip270/inv/devpay?ref='+invoice.ref).catch(e => console.log(e));
    }

    document.getElementById('subtotal').textContent = invoice.subtotal.toLocaleString();
    document.getElementById('urlPath').textContent = invoice.urlPath;

    new QRCode("QRCode", { text: invoice.dataURL, width: 160, height: 160 });

    document.getElementById('QRCode').setAttribute('href', invoice.dataURL);
    document.getElementById('loading-invoice').style.display = 'none';
    document.getElementById('inv-details').style.display = '';
    
    var sseURL = '/.bip270/inv/sse?ref=' + invoice.ref;
    var evtSource = new EventSource(sseURL);

    evtSource.onmessage = function(event) {
        console.log('message', event.data);
        location.reload();
    };

    evtSource.onopen = function() {
        console.log("SSE Connection opened.");
    };

    evtSource.onerror = function() {
        console.log("SSE Connection error.");
        evtSource.close();
    };

    setTimeout(function () {
        document.getElementById('expired').style.display = '';
        document.getElementById('loading-invoice').style.display = 'none';
        document.getElementById('inv-details').style.display = 'none';
        if (evtSource) {
            evtSource.close();
        }
    }, invoice.expiry - Date.now());
}