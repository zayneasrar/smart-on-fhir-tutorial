if (document.querySelector) {
    window.addEventListener("load", function () {
        'use strict';
        var fhir_url,
            code_params = {},
            refresh_token,
            loginWindow,
            oldAuthCode,
            resourceServerField = document.getElementById("resource_server");

        window.addEventListener("message", function (e) {
            var newAuthCode = e.data;

            if (newAuthCode !== oldAuthCode && newAuthCode !== null) {
                console.log("Received parameters from authorization grant callback URL: " + newAuthCode);

                loginWindow.close();
                displayCode(newAuthCode);
            }
        }, false);

        // Utility method from: http://stackoverflow.com/a/3855394
        var queryParams = (function(a) {
            if (a == "") return {};
            var b = {};
            for (var i = 0; i < a.length; ++i)
            {
                var p=a[i].split('=', 2);
                if (p.length == 1)
                    b[p[0]] = "";
                else
                    b[p[0]] = decodeURIComponent(p[1].replace(/\+/g, " "));
            }
            return b;
        })(window.location.search.substr(1).split('&'));

        if (queryParams["iss"] !== undefined) {
            document.getElementById("fhir_base_url").value = queryParams["iss"];
        }

        if (queryParams["launch"] !== undefined) {
            document.getElementById("launch").value = queryParams["launch"];
        }

        if (document.body.dataset !== undefined) {
            resourceServerField.value = document.body.dataset.resourceserver;
        } else { // IE 10- fallback
            resourceServerField.value = document.getElementsByTagName("body")[0].getAttribute("data-resourceserver");
        }

       /* Get token button */
        document.getElementById("get_token").addEventListener("click", function () {
            document.getElementById("grant_type").value = "client_credentials";

            var token_params = {};
            token_params.token_uri = document.getElementById("token_uri").value;
            token_params.client_key = document.getElementById("client_key").value;
			token_params.client_secret = document.getElementById("client_secret").value;
            token_params.grant_type = document.getElementById("grant_type").value;
            
            var http_input = document.getElementById("access_http_response");

            if (token_params.token_uri === '' || token_params.client_key === '' || token_params.client_secret === '' || token_params.grant_type === '') {
                document.getElementById("token_response_field").value = 'Missing required fields.';
            } else {
                postTokenForm(document.getElementById("token_response_field"), document.getElementById("resource_request_field"), http_input, token_params.token_uri, build_token_request(token_params), function () {
                    try {
                    	var jsonResponse = JSON.parse(this.responseText);
	                	if (jsonResponse.refresh_token !== undefined && jsonResponse.scope.search("offline_access") == -1 ) {
	                        document.getElementById("get_refresh_token").style.display = "inline-block";
	
	                        refresh_token = undefined;
	                    } else {
	                        document.getElementById("get_refresh_token").style.display = "none";
	                    }
                    } catch (e) {
                    	console.log("Error parsing response:" + e);
                    }
                });

                document.getElementById("resource_response_field").value = "";
            }
        });

        /* Get refresh token button */
        document.getElementById("get_refresh_token").addEventListener("click", function () {

            if (refresh_token === undefined) {
                refresh_token = JSON.parse(document.getElementById("token_response_field").value).refresh_token;
            }

            document.getElementById("grant_type").value = "refresh_token";

            var token_params = {};
            token_params.token_uri = document.getElementById("token_uri").value;
            token_params.client_id = document.getElementById("client_id_2").value;
            token_params.grant_type = document.getElementById("grant_type").value;
            token_params.redirect_uri = document.getElementById("redirect_uri_2").value;
            token_params.token_code = document.getElementById("code").value;
            token_params.state = document.getElementById("state_2").value;
            token_params.refresh_token = refresh_token;

            var http_input = document.getElementById("access_http_response");

            if (token_params.token_uri === '' || token_params.client_id === '' || token_params.grant_type === '' || token_params.token_code === '') {
                document.getElementById("token_response_field").value = 'Missing required fields.';
            } else {
                postTokenForm(document.getElementById("token_response_field"), document.getElementById("resource_request_field"), http_input, token_params.token_uri, build_token_request(token_params), null);
                document.getElementById("resource_response_field").value = "";
            }
        });

        /* Submit token button */
        document.getElementById("submit_token").addEventListener("click", function () {
            var token = document.getElementById('resource_request_field').value,
                parsedToken,
                xmlHttp,
                responseContainer = document.getElementById("resource_response_field_container"),
                responseTextField,
                loadingNode,
                response,
                header,
                claims;

            // Check for missing resource server field
            if (resourceServerField.value === '') {
                document.getElementById("resource_response_field").value = 'Missing resource server.';
                return;
            }

            // Check for missing token
            if (token === '') {
                document.getElementById("resource_response_field").value = 'Missing token.';
                return;
            }

            // Check for token error
            if (token.toLowerCase().indexOf('error') > 0) {
                document.getElementById("resource_response_field").value = 'Error parsing access token.';
                return;
            }

            // Check for auth token validity
            try {
                parsedToken = JSON.parse(token);
            } catch (syntaxError) {
                document.getElementById("resource_response_field").value = 'Error parsing access token.';
                return;
            }

            // Access token
            responseTextField = document.getElementById("resource_response_field");

            // Replace text field with loading gif
            loadingNode = document.createElement('img');
            loadingNode.src = 'https://devcernercentral.com/resources/core/v2.11/images/loading.gif';
            loadingNode.alt = 'loading';
            responseContainer.appendChild(loadingNode);
            responseContainer.replaceChild(loadingNode, responseContainer.childNodes[0]);

            // Make request
            xmlHttp = new XMLHttpRequest();
            xmlHttp.open("GET", resourceServerField.value, true);
            xmlHttp.setRequestHeader('Authorization', 'Bearer ' + parsedToken.access_token);
            if (document.getElementById("accept_header").value !== "") {
                xmlHttp.setRequestHeader('Accept', document.getElementById("accept_header").value);
            } else {
                xmlHttp.setRequestHeader('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8');
            }
            xmlHttp.send(null);

            // Replace loading gif when finished
            xmlHttp.onreadystatechange = function () {
                if (xmlHttp.readyState === 4 && responseTextField !== null) {
                    responseContainer.appendChild(responseTextField);
                    responseContainer.replaceChild(responseTextField, responseContainer.childNodes[0]);

                    document.getElementById("resource_http_response").value = xmlHttp.status;

                    // Valid response
                    if (xmlHttp.status === 200) {
                        response = xmlHttp.response;
                        try {
                            header = JSON.stringify(JSON.parse(response.substring(response.indexOf('Token Header:') + 13, response.indexOf('Token Claims:'))), null, 2);
                            claims = JSON.stringify(JSON.parse(response.substring(response.indexOf('Token Claims:') + 13, response.length)), null, 2);

                            responseTextField.value = "Token Header:\r\n" + header + "\r\n\r\nToken Claims:\r\n" + claims;
                        } catch (syntaxError) {
                            document.getElementById("resource_response_field").value = response;
                        }
                        // Invalid resource server
                    } else {
                        document.getElementById("resource_response_field").value = 'Error accessing resource endpoint.';
                    }
                }
            };
        });
    }, false);
}

function build_code_request(params) {
    'use strict';

    return params.auth_server + "?" +
        "client_id=" + encodeURIComponent(params.client_id) + "&" +
        "response_type=" + encodeURIComponent(params.response_type) + "&" +
        "redirect_uri=" + encodeURIComponent(params.redirect_uri) + "&" +
        "scope=" + encodeURIComponent(params.oauth_scope) + "&" +
        "launch=" + encodeURIComponent(params.launch) + "&" +
        "aud=" + encodeURIComponent(params.aud) + "&" +
        "state=" + encodeURIComponent(params.state);
}

function displayCode(query) {
    'use strict';

    var vars = query.split("&");

    function params(param) {
        var pair,
            i;

        for (i = 0; i < vars.length; i += 1) {
            pair = vars[i].split("=");
            if (pair[0] === param) {
                return pair[1];
            }
        }
    }

    document.getElementById("code_response_field").value = query;
    document.getElementById("code").value = params("code");
    document.getElementById("state_2").value = params("state");
    document.getElementById("client_id_2").value = document.getElementById("client_id_1").value;

    if (document.getElementById("token_uri").value === "") {
        if (document.getElementById("auth_server_uri").value.indexOf("personas/patient/authorize") > -1) {
            document.getElementById("token_uri").value = document.getElementById("auth_server_uri").value.replace("personas/patient/authorize", "token");
        } else if (document.getElementById("auth_server_uri").value.indexOf("personas/provider/authorize") > -1) {
            document.getElementById("token_uri").value = document.getElementById("auth_server_uri").value.replace("personas/provider/authorize", "token");
        }
    }

    document.getElementById("token_response_field").value = "";
    document.getElementById("resource_response_field").value = "";
    document.getElementById("get_refresh_token").style.display = "none";
}

function build_token_request(params) {
    'use strict';
    var request_uri = "grant_type=" + encodeURIComponent(params.grant_type) + "&" +
        "client_key=" + encodeURIComponent(params.client_key) + "&" +
		"client_secret=" + encodeURIComponent(params.client_secret);

    if (params.redirect_uri !== "") {
        request_uri += "&redirect_uri=" + encodeURIComponent(params.redirect_uri);
    }

    if (params.refresh_token !== undefined) {
        request_uri = "grant_type=" + encodeURIComponent(params.grant_type) + "&" +
            "refresh_token=" + encodeURIComponent(params.refresh_token);
    }

    return request_uri;
}

function postTokenForm(input, input2, statusInput, theUrl, theContent, callback) {
    'use strict';

    var xmlHttp = new XMLHttpRequest(),
        jsonContent,
        consoleMessage;

    consoleMessage = "Posting url encoded form in order to retrieve a ";

    if (callback === null) {
        consoleMessage = consoleMessage + "refresh token:";
    } else {
        consoleMessage = consoleMessage + "token:";
    }

    consoleMessage = consoleMessage + "\n" + theContent;

    console.log(consoleMessage);

    xmlHttp.open("POST", theUrl);
    xmlHttp.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
    xmlHttp.send(theContent);

    xmlHttp.onreadystatechange = function () {
        if (xmlHttp.readyState === 4) {
            jsonContent = xmlHttp.responseText;

            statusInput.value = xmlHttp.status;

            try {
                input.value = JSON.stringify(JSON.parse(jsonContent), null, 2);

                if (jsonContent.indexOf('error_description') <= 0) {
                    if (jsonContent.indexOf('error_uri') <= 0) {
                        console.log("Successfully received token response from server");
                    }

                    input2.value = JSON.stringify(JSON.parse(jsonContent), null, 2);
                } else {
                    input2.value = "";
                }
            } catch (e) {
                input.value = jsonContent;

                if (jsonContent.indexOf('error_description') <= 0) {
                    input2.value = jsonContent;
                } else {
                    input2.value = "";
                }
            }

            if (typeof callback === "function") {
                callback.apply(xmlHttp);
            }
        }
    };
}
