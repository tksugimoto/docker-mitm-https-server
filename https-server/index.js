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
    const YYYY = date.getFullYear();
    const MM = (date.getMonth() + 1).toString().padStart(2, '0');
    const DD = date.getDate().toString().padStart(2, '0');
    const HH = date.getHours().toString().padStart(2, '0');
    const mm = date.getMinutes().toString().padStart(2, '0');
    const ss = date.getSeconds().toString().padStart(2, '0');
    const sss = date.getMilliseconds().toString().padStart(3, '0');
    return `${YYYY}/${MM}/${DD} ${HH}:${mm}:${ss}.${sss}`;
};

const log = text => {
    console.info(`[${currentTime()}] ${text}`);
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
    // HTTPリクエストを受け取ってから接続しないと、クライアント側の証明書検証で切断されてもプロキシサーバーへ接続してしまう
    clientTlsSocket.once('data', dataBuffer => {
        let hostname = clientTlsSocket.servername;
        if (!hostname) {
            const httpRequestArray = dataBuffer.toString().split(CRLF);
            const hostHeader = httpRequestArray.find(header => header.startsWith('Host:'));
            if (!hostHeader) {
                log('Request error: Request does not support Server Name Indication and Host header not found');
                clientTlsSocket.end();
                return;
            }
            hostname = hostHeader.slice('Host:'.length).trim().replace(/:.*/, '');
        }

        const proxyServerSocket = net.createConnection(httpsProxyPort, httpsProxyHost);
        proxyServerSocket.once('connect', () => {
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
                    log(`Failed to relay on proxy server: ${hostname} (${statusLine})`);
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
                    socket.write(dataBuffer);
                    clientTlsSocket.pipe(socket);
                    socket.pipe(clientTlsSocket);
                });
                socket.on('error', err => {
                    log(`TLS Socket error: ${err.message}`);
                    console.error(err);
                });
            });
            proxyServerSocket.on('error', err => {
                log(`Proxy Server Socket error: ${err.message}`);
                console.error(err);
                clientTlsSocket.end();
            });
            proxyServerSocket.on('close', () => {
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

