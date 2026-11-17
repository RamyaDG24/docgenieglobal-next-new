// CloudFront Function (runtime cloudfront-js-2.0), event type: viewer request.
// Attach to the distribution's DEFAULT behaviour (the website Lambda) only.
//
// Replaces the old .htaccess rule "non-www -> www": a request for
// docgenieglobal.com/<path>?<query> gets a 301 to https://www.docgenieglobal.com/<path>?<query>.
// Everything else passes through unchanged (Next.js in the Lambda does all
// other redirects, the trailing slashes, the headers and the 404 page).
//
// http -> https is NOT done here: set the behaviour's Viewer protocol policy
// to "Redirect HTTP to HTTPS" (also a 301).
//
// Tested by aws/tests/www-redirect.test.mjs and used by the local run.

var CANONICAL_HOST = "www.docgenieglobal.com";
var REDIRECT_HOSTS = ["docgenieglobal.com"];

function buildQuery(qs) {
  var parts = [];
  for (var key in qs) {
    var item = qs[key];
    var values = item.multiValue ? item.multiValue : [item];
    for (var i = 0; i < values.length; i++) {
      parts.push(key + "=" + values[i].value);
    }
  }
  return parts.length ? "?" + parts.join("&") : "";
}

// Called by CloudFront (and by aws/lib/cloudfront-function.mjs in tests), not by this file.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function handler(event) {
  var request = event.request;
  var host = request.headers.host ? request.headers.host.value.toLowerCase() : "";

  if (REDIRECT_HOSTS.indexOf(host) !== -1) {
    return {
      statusCode: 301,
      statusDescription: "Moved Permanently",
      headers: {
        location: { value: "https://" + CANONICAL_HOST + request.uri + buildQuery(request.querystring || {}) },
      },
    };
  }

  return request;
}
