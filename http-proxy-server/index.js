const net = require('net');
const http = require('http');

const CRLF = '\r\n';
const HTTPS_PORT = 443;
const HTTP_PROXY_PORT = 3128;


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

const proxyServer = http.createServer();

const STATUS_CODE_Method_Not_Allowed = 405;
proxyServer.on('request', (request, response) => {
    log(`${request.socket.remoteAddress} "${request.method} ${request.url} HTTP/${request.httpVersion}" "${request.headers['user-agent']}"`);
    response.writeHead(STATUS_CODE_Method_Not_Allowed).end();
});

proxyServer.on('connect', (req, clientSocket) => {
    log(`${clientSocket.remoteAddress} "${req.method} ${req.url} HTTP/${req.httpVersion}" "${req.headers['user-agent']}"`);
    const serverSocket = net.createConnection(HTTPS_PORT, process.env.FORWARDING_CONTAINER);
    serverSocket.once('connect', () => {
        clientSocket.write(`HTTP/1.1 200 Connection established${CRLF}${CRLF}`);
        clientSocket.pipe(serverSocket);
        serverSocket.pipe(clientSocket);
    });
    serverSocket.on('error', err => {
        log(`Server Socket error: ${err.message}`);
        console.error(err);
    });
    clientSocket.on('error', err => {
        log(`Client Socket error: ${err.message}`);
        console.error(err);
    });
});

proxyServer.on('error', err => {
    log(`Proxy Server error: ${err.message}`);
    console.error(err);
});

proxyServer.listen(HTTP_PROXY_PORT, '0.0.0.0', () => {
    log('Proxy Server started');
});

