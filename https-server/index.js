const assert = require('assert');
const fs = require('fs');
const tls = require('tls');
const http = require('http');
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
const TARGET_PORT = Number(process.env.TARGET_PORT) || HTTPS_PORT;

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

/**
 *
 * @param {string} hostHeader
 * @param {string} servername
 */
const extractHostInfo = (hostHeader, servername) => {
    if (hostHeader) {
        const {
            hostname,
            port,
        } = parseUrl(`https://${hostHeader.slice('Host:'.length).trim()}/`);

        return {
            hostname,
            port: port ? Number(port) : HTTPS_PORT,
        };
    } else if (servername) {
        // ホストヘッダーがない場合、port番号不明のため TARGET_PORT を使用 (port番号の特定が確実ではない)
        return {
            hostname: servername,
            port: TARGET_PORT,
        };
    } else {
        return {
            hostname: null,
            port: null,
        };
    }
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
        // 非同期処理をするときは flowing mode から paused mode に切り替えないと、クライアントから来るデータが失われる(HTTP POST Body など 分割された場合)
        clientTlsSocket.pause();

        const httpRequestArray = dataBuffer.toString().split(CRLF);
        const hostHeader = httpRequestArray.find(header => header.startsWith('Host:'));

        const {
            hostname,
            port,
        } = extractHostInfo(hostHeader, clientTlsSocket.servername);

        if (!hostname) {
            log('Request error: Request does not support Server Name Indication and Host header not found');
            clientTlsSocket.end();
            return;
        }

        const proxyRequestOptions = {
            hostname: httpsProxyHost,
            port: httpsProxyPort,
            method: 'CONNECT',
            path: `${hostname}:${port}`,
            headers: {
                Host: `${hostname}:${port}`,
            },
        };
        if (httpsProxyAuth) {
            proxyRequestOptions.headers['Proxy-Authorization'] = `Basic ${Buffer.from(httpsProxyAuth).toString('base64')}`;
        }

        const proxyServerRequest = http.request(proxyRequestOptions);
        proxyServerRequest.on('connect', (res, proxyServerSocket) => {
            log(`forward request to ${hostname}:${port}`);
            if (res.statusCode !== 200) {
                log(`Failed to relay on proxy server: ${hostname}${port} (${res.statusCode} ${res.statusMessage})`);
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
        proxyServerRequest.on('error', err => {
            log(`Proxy Server Request error: ${err.message}`);
            console.error(err);
            clientTlsSocket.end();
        });
        proxyServerRequest.end();
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

