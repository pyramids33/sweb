

// function matchSegments (patternSegments:string[], urlPathSegments:string[])  {
//     return patternSegments.every((seg:string, i:number) => i < urlPathSegments.length && seg === urlPathSegments[i] || seg === '*')
// }

// interface MatchResult { 
//     pattern:string, 
//     match:string 
// }

// function matchUrl (urlPath:string, patterns:string[]) : MatchResult|undefined {

//     let result:MatchResult|undefined = undefined;

//     const urlPathSegments = urlPath.split('/').filter(x => x != '');
    
//     for (const pattern of patterns) {
//         const patternSegments = pattern.split('/').filter(x => x != '');

//         if (matchSegments(patternSegments, urlPathSegments)) {
//             const match = '/'+urlPathSegments.slice(0, patternSegments.length).join('/');

//             if (result === undefined || match.length > result.match.length) {
//                 result = { pattern, match };
//             }
//         }
//     }

//     return result;
// }


const patterns1 = [
    '/test/*/def/',
];
const patterns2 = [
    '/test/*/def',
];

const urlPaths = [
    '/tset/abc/',
    '/test/abc/',
    '/test/abc/def',
    '/test/abc/def/',
    '/test/abc/def/hij',
    '/test/xyz',
    '/test/xyz/',
]

// for (const urlPath of urlPaths) {
//     console.log('urlPath:', urlPath);
//     console.log(matchUrl(urlPath,patterns1));
//     console.log();
// }

// for (const urlPath of urlPaths) {
//     console.log('urlPath:', urlPath);
//     console.log(matchUrl(urlPath,patterns2));
//     console.log();
// }
