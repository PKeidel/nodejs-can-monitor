const logger = require('debug')('canmonitor:sockets');
const SerialPort = require('serialport');

// 1. Define Inputs
class Input {
    constructor(n) {
        this.name = n || 'not name set';
        this.detail = '';
        this.isRunning = false;
        this.holder = null;
    }
    start() {
        throw new Error('start() not implemented');
    }
    list() {
        throw new Error('start() not implemented');
    }
    close() {
        if(this.holder && typeof this.holder.close === 'function')
            this.holder.close();
        this.isRunning = false;
    }
}

// 1.1 Arduino via Serial
class ArduinoViaSerial extends Input {
    constructor() {
        super('Arduino Serial');
    }
    start(callback, port) {
        if(!callback || typeof callback !== 'function')
            throw new Error('start() must be called with a callback function as argument');

        this.name += ': ' + port;

        logger("Started: " + this.name);

        this.holder = new SerialPort(port, {
            baudRate: 115200,
            parser: SerialPort.parsers.byteDelimiter([0xFE, 0xFF])
        });

        this.isRunning = true;

        this.holder.on('data', function (data) {
            const canID = (data[0] << 8 | data[1]);
            data = data.splice(2);
            data.pop();
            data.pop();
            // console.log("ondata: canID=%s, data=" + data, canID.toString(16).toUpperCase());
            callback(canID, data);
        });
    }
    list(callback) {
        if(this.holder && typeof this.holder.list === 'function') {
            this.holder.list(callback);
        }
    }
}

// 1.2 File
class File extends Input {
    constructor() {
        super('File');
    }
    start(callback) {
        if(!callback || typeof callback !== 'function')
            throw new Error('start() must be called with a callback function as argument');

        logger("Started: " + this.name);

        let sendCount = 0, sendOffset = Math.round(Math.random() * 51000);
        this.holder = require('readline').createInterface({
            input: require('fs').createReadStream('logs/logfile_2016-08-05T21:35:08.329Z.txt')
        });

        this.holder.on('line', function (line) {
            if(sendCount > 400) {
                this.isRunning = false;
                return;
            }

            if(sendOffset <= 0) {
                let infosStr = line.split(" ");
                let infos = [];
                for(let i = 0; i < infosStr.length; i++)
                    infos.push(parseInt(infosStr[i], 16));
                if(infos.length === 14) {
                    sendCount++;
                    const canID = infos[3] << 8 | infos[4];
                    infos.splice(0, 5);
                    infos.pop();
                    callback(canID, infos);
                }
            } else {
                sendOffset--;
            }
        });

        this.isRunning = true;
    }
    list(callback) {
        if(this.holder && typeof this.holder.list === 'function')
            this.holder.list(callback);
    }
}

// 1.3 Random Values
// class Random extends Input {
//     constructor() {
//         super('Random');
//         this.oldValue = 50;
//     }
//     start(callback) {
//         var that = this;
//         this.holder = setInterval(function() {
//             that.oldValue += (Math.random() - .45) * 5;
//             if(that.oldValue < 0)
//                 that.oldValue = 10;
//             if(that.oldValue >= 255)
//                 that.oldValue = 100;
//             callback(0x4F0, [0,Math.round(that.oldValue),0,0,0,0,0,0]);
//         }, 300);
//     }
//     stop() {
//         clearInterval(this.holder);
//     }
// }

// 1.4 Random File (forever)
class Random extends Input {
    constructor() {
        super('Random');
    }
    start(callback) {
        if(!callback || typeof callback !== 'function')
            throw new Error('start() must be called with a callback function as argument');

        const that = this;

        logger("Started: " + this.name);

        function read() {
            // const start = +new Date();
            let sendCount = 0, sendOffset = Math.round(Math.random() * 51000);
            this.holder = require('readline').createInterface({
                input: require('fs').createReadStream('logs/logfile_2016-08-05T21:35:08.329Z.txt')
            });

            this.holder.on('line', function (line) {
                if(sendCount > 500) {
                    that.close();
                    this.isRunning = false;
                    // const end = +new Date();
                    // logger("DURATION: " + (end - start) + "ms");
                    return;
                }

                if(sendOffset <= 0) {
                    let infosStr = line.split(" ");
                    let infos = [];
                    for(let i = 0; i < infosStr.length; i++)
                        infos.push(parseInt(infosStr[i], 16));
                    if(infos.length === 14) {
                        sendCount++;
                        const canID = infos[3] << 8 | infos[4];
                        infos.splice(0, 5);
                        infos.pop();
                        callback(canID, infos);
                    }
                } else {
                    sendOffset--;
                }
            });
        }

        // To read every X ms a few hundred lines
        setInterval(read, 500);

        this.isRunning = true;
    }
    list(callback) {
        if(this.holder && typeof this.holder.list === 'function')
            this.holder.list(callback);
    }
}

Object.filter = (obj, predicate) =>
    Object.assign({}, ...Object.keys(obj)
        .filter(key => predicate(obj[key]))
        .map(key => ({ [key]: obj[key]})));

Object.map = (obj, predicate) =>
    Object.assign({}, ...Object.keys(obj)
        .map(key => ({ [key]: predicate(obj[key], key)})));

module.exports = function(server) {
    let collectForMs = 400;
    let io, nextClientID = 1, ports, currentInput;
    let ignoreIDs = {}, lastValues = {}, sendDiff = {};
    let intervallHandle, totalCount = 0, sendCount = 0;
    let countPerID = {};

    function sendAllPorts(client) {
        SerialPort.list(function (err, p) {
            ports = Object.filter(p, port => port.comName.indexOf('USB') >= 0); // .map(key => console.log(key)); // .map( key => 'Arduino Serial: ' + key );
            ports = Object.map(ports, o => {
                o.comName = 'Arduino Serial: ' + o.comName;
                return o;
            });
            (client || io.sockets).send({ports: ports, connected: (currentInput && currentInput.isRunning && currentInput.name) || null});
        });
    }

    function groupAndSend(canID, buf) {
        if(!intervallHandle)
            intervallHandle = setTimeout(sendThatBytes, collectForMs);

        totalCount++;

        while(buf.length < 8)
            buf.unshift(0);

        const key = 'canid_0x' + canID.toString(16).toUpperCase();

        // Key hinzufügen falls er noch nicht existiert
        if(!sendDiff.hasOwnProperty(key)) {
            sendDiff[key] = [[buf[0]],[buf[1]],[buf[2]],[buf[3]],[buf[4]],[buf[5]],[buf[6]],[buf[7]]];
            // console.log("sendDiff=%o", sendDiff);
            return;
        }

        const bytes = sendDiff[key];
        for(let j = 0; j < 8; j++) {
            // Wenn der letzte Wert anders als der jetzige ist,
            // dann den neuen Wert hinzufügen
            if(bytes[j].length && bytes[j][bytes[j].length - 1] && bytes[j][bytes[j].length - 1] !== buf[j])
                bytes[j].push(buf[j]);
        }
    }

    function sendThatBytes() {

        // sendDiff aufräumen
        // var popCount = 0;
        for(let cid in sendDiff) {
            if(sendDiff.hasOwnProperty(cid) && lastValues.hasOwnProperty(cid)) {
                for(let i = 0; i < 8; i++) {
                    const values = sendDiff[cid][i];
                    if(values[values.length - 1] === lastValues[cid][i]) {
                        // console.log("Remove: ID: %s, Byte: %d, removed value: %d", cid, i, values.pop());
                        values.pop();
                        // popCount++;
                    }
                }
            }
        }

        io.send({sendDiff: sendDiff, totalCount: totalCount, countPerID: countPerID/*, ignoredCount: ignoredCount, popCount: popCount*/});

        for(let cid in sendDiff) {
            if(sendDiff.hasOwnProperty(cid)) {
                if(!lastValues.hasOwnProperty(cid))
                    lastValues[cid] = [-1,-1,-1,-1,-1,-1,-1,-1];

                for(let i = 0; i < 8; i++) {
                    if(!sendDiff[cid][i].length)
                        continue;
                    const values = sendDiff[cid][i];
                    if(values[values.length - 1] !== lastValues[cid][i]) {
                        lastValues[cid][i] = values[values.length - 1];
                    }
                }
            }
        }

        // reset
        intervallHandle = null;
        sendDiff = {};
        // ignoredCount = 0;
        totalCount = 0;
        countPerID = {};
    }

    function start_fromFile() {
        currentInput = new File();
        currentInput.start(function(canID, bytes) {
            groupAndSend(canID, bytes);
        });
    }

    function start_fromRandom() {
        currentInput = new Random();
        currentInput.start(function(canID, bytes) {
            groupAndSend(canID, bytes);
        });
    }

    function start_fromSerial(port) {
        currentInput = new ArduinoViaSerial();
        currentInput.start(function(canID, bytes) {
            groupAndSend(canID, bytes);
        }, port);
        sendAllPorts();
    }

    function stop_all() {
        currentInput && currentInput.close();
        currentInput = null;
        sendAllPorts();
    }

    return {
        start: function() {
            io = require('socket.io')(server);

            io.on('connection', function(client) {
                client.clientID = nextClientID++;

                client.on('message', function(data) {
                    logger('Received: %o', data);

                    sendCount = 0;

                    // Wenn ein Port gewählt werden soll
                    if(data.select) {
                        stop_all();

                        if(data.select === 'file')
                            start_fromFile();
                        else if(data.select === 'console')
                            start_fromCommandline();
                        else if(data.select === 'random')
                            start_fromRandom();
                        else if(data.select.indexOf('Arduino Serial: ') === 0)
                            start_fromSerial(data.select.replace(/Arduino Serial: /, ''));
                        else
                            throw new Error('Unknown input: ' + data.select);
                    }

                    if(data.stop)
                        stop_all();

                    if(data.resetLastValues)
                        lastValues = {};

                    if(data.collectForMs)
                        collectForMs = data.collectForMs;
                });

                setTimeout(function() {
                    sendAllPorts(client);
                    client.send({collectForMs: collectForMs});
                }, 200);
            });

            setInterval(sendAllPorts, 15000);
            // sendAllPorts();
        }
    };
};