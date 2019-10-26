const assert = require('assert');
const fs = require('fs');
const tls = require('tls');
const net = require('net');
const {
    parse: parseUrl,
} = require('url');

assert(process.env.https_proxy, 'https_proxy env ("http://hostname:port") required.');

const {
    hostname: httpsProxyHost,
    port: httpsProxyPort,
    auth: httpsProxyAuth,
} = parseUrl(process.env.https_proxy);


const CRLF = '\r\n';
const HTTPS_PORT = 443;

const currentTime = () => {
    const date = new Date();
    const h = date.getHours();
    const m = date.getMinutes();
    const s = date.getSeconds();
    const ms = date.getMilliseconds();
    return `${h}:${m}:${s}.${ms}`;
};

const log = text => {
    console.info(`[${currentTime()}] ------------- ${text} -------------`);
};

const tlsServer = tls.createServer({
    key: fs.readFileSync(`${process.env.server_key_dir}/server-key.pem`),
    cert: fs.readFileSync(`${process.env.server_key_dir}/server.crt`),
});

const rootCertificates = Array.from(tls.rootCertificates);
if (process.env.root_cert_file_name) {
    log('provided-root-ca used');
    const rootCertificate = fs.readFileSync(`./.provided-root-ca/${process.env.root_cert_file_name}`);
    rootCertificates.push(rootCertificate);
}

tlsServer.on('secureConnection', (clientTlsSocket) => {
    clientTlsSocket.once('data', dataBuffer => {
        const httpRequestArray = dataBuffer.toString().split(CRLF);
        const hostHeader = httpRequestArray.find(header => header.startsWith('Host:'));
        if (!hostHeader) {
            log('Request error: Host header not found');
            clientTlsSocket.end();
            return;
        }

        const proxyServerSocket = net.createConnection(httpsProxyPort, httpsProxyHost);
        proxyServerSocket.once('connect', () => {
            const hostname = hostHeader.slice('Host:'.length).trim().replace(/:.*/, '');
            log(`forward request to ${hostname}`);

            proxyServerSocket.write(`CONNECT ${hostname}:${HTTPS_PORT} HTTP/1.0${CRLF}`);
            proxyServerSocket.write(`Host: ${hostname}:${HTTPS_PORT}${CRLF}`);
            if (httpsProxyAuth) {
                proxyServerSocket.write(`Proxy-Authorization: Basic ${Buffer.from(httpsProxyAuth).toString('base64')}${CRLF}`);
            }
            proxyServerSocket.write(CRLF);
            proxyServerSocket.once('data', data => {
                const response = data.toString();
                const statusLine = response.split(CRLF)[0];
                const [/* version */, statusCode] = statusLine.split(' ');
                if (statusCode !== '200') {
                    console.error(statusLine);
                    clientTlsSocket.end();
                    return;
                }

                const options = {
                    socket: proxyServerSocket,
                    servername: hostname,
                    rejectUnauthorized: true,
                    secureContext :tls.createSecureContext({
                        ca: rootCertificates,
                    }),
                };
                const socket = tls.connect(options);
                socket.once('secureConnect', () => {
                    log(`TLS Socket secureConnect: authorized: ${socket.authorized}`);

                    socket.write(dataBuffer);
                    clientTlsSocket.pipe(socket);
                    socket.pipe(clientTlsSocket);
                });
                socket.on('connect', () => {
                    log('TLS Socket connect');
                });
                socket.on('error', err => {
                    log(`TLS Socket error: ${err.message}`);
                    console.error(err);
                });
                socket.on('close', () => {
                    log('TLS Socket close');
                });
            });
            proxyServerSocket.on('error', err => {
                log(`Proxy Server Socket error: ${err.message}`);
                console.error(err);
                clientTlsSocket.end();
            });
            proxyServerSocket.on('close', () => {
                log('Proxy Server Socket close');
                clientTlsSocket.end();
            });
        });
    });
    clientTlsSocket.on('error', err => {
        log(`Client Socket error: ${err.message}`);
        console.error(err);
    });
});

tlsServer.on('error', err => {
    log(`TLS Server Socket error: ${err.message}`);
    console.error(err);
});

tlsServer.listen(HTTPS_PORT, '0.0.0.0', () => {
    log('server started');
});

