let messageCount = {}, messageCountPerID = {}, seconds = 0,
    serialports = document.querySelector('#serialports'),
    table = document.querySelector('#table'),
    details = document.querySelector('#details'),
    btnIgnoreStart = document.querySelector('#btnIgnoreStart'),
    btnIgnoreStop = document.querySelector('#btnIgnoreStop'),
    carstatus = document.querySelector('#carstatus'),
    newmessage = document.querySelector('#newmessage'),
    changedFields = {}, dps = [], known = {}, isRunning = false, mode = 0,
    updateIgnoredValues = true, valueIsFloating = true, displayCANids = {}, ignore = {};

const gui = new GUI();
const socket = io('http://' + window.location.hostname + ':3000');
const chart = new MyChart("chartContainer");

function replaceString(str, obj) {
    if(typeof obj.cid !== 'undefined') str = str.replace(/\$\{cid\}/g, obj.cid);
    if(typeof obj.byteNr !== 'undefined') str = str.replace(/\$\{byteNr\}/g, obj.byteNr);
    if(typeof obj.value !== 'undefined') str = str.replace(/\$\{value\}/g, obj.value);
    return str;
}

function changed_collectForMs(ms) {
    if(ms)
        gui.cachedQuerySelector('#collectForMs').value = ms;
    socket.send({collectForMs: gui.cachedQuerySelector('#collectForMs').value});
    gui.cachedQuerySelector('#collectForMsLabel').textContent = 'update alle ' + gui.cachedQuerySelector('#collectForMs').value + 'ms';
}

/** Alle bekannten Bytes auf die Ignore Liste setzen */
function ignoreKnown() {
    ignore = {};
    const ignored = document.querySelectorAll('#table td.ignored');
    for(let i = 0; i < ignored.length; i++)
        ignored[i].classList.remove('ignored');
    for(let cid in known) {
        if(known.hasOwnProperty(cid)) {
            for(let b in known[cid])
                if(known[cid].hasOwnProperty(b) && (!ignore.hasOwnProperty(cid + '_b' + b.replace(/byte_/, '')) || !ignore[cid + '_b' + b.replace(/byte_/, '')])) {
                    ignore[cid + '_b' + b.replace(/byte_/, '')] = true;
                    const c = gui.cachedQuerySelector('#' + cid + ' td[data-bytenr="' + b.replace(/byte_/, '') + '"]');
                    if(c)
                        c.classList.add('ignored');
                }
        }
    }
}

socket.on('message', function (data) {
    if (data.hasOwnProperty('ports')) {
        if(!data.connected)
            isRunning = false;
        showPorts(data.ports, data.connected);

    } else if (data.hasOwnProperty('collectForMs')) {
        changed_collectForMs(data.collectForMs);

    } else if (data.hasOwnProperty('sendDiff')) {
        // Nach F5 Chart wieder anzeigen
        isRunning = true;

        messageCount[seconds] = (messageCount[seconds] || 0) + data.totalCount;
        // messageCountPerID[canID][seconds] = messageCountPerID[canID][seconds] + 1 || 1;
        // linechart.nextColumn();

        // Daten auseinander friemeln und irgendwie anzegein..wird schon :)
        for(const cid in data.sendDiff) {
            if(data.sendDiff.hasOwnProperty(cid)) {

                // TODO: Der count pro canID wird noch nicht geliefert
                messageCountPerID[cid] = messageCountPerID[cid] || {'insg': 0};
                messageCountPerID[cid]['insg']++;

                const tr = document.querySelector('#' + cid);
                if(tr) {
                    // update

                    let addedSthToDetails = false;
                    for(let i = 0; i < 8; i++) {
                        const selector = '#' + cid + ' td:nth-child(' + (i + 2) + ') span.content';
                        const values = data.sendDiff[cid][i], c = document.querySelector(selector);
                        if(values.length) {
                            const newValue = values.length ? values[values.length - 1] : '-';
                            const citxt    = c.textContent;
                            let currentHexValue;
                            if(citxt.length && citxt !== 'M')
                                currentHexValue = citxt.match(/(0x[A-F0-9]{1,3})/)[1];

                            if(!currentHexValue || parseInt(currentHexValue, 16) !== newValue) {

                                if(updateIgnoredValues || (!updateIgnoredValues && !isIgnored(cid, i + 1))) {
                                    // nach F5 ist die Zelle leer, dann per innerHTML alles neu setzen
                                    if(gui.cachedQuerySelector(selector + ' i.bin')) {
                                        // https://jsperf.com/one-innerhtml-vs-multiple-textcontent/1
                                        gui.cachedQuerySelector(selector + ' i.bin').textContent = Helper.toBin(newValue);
                                        gui.cachedQuerySelector(selector + ' span.hex').textContent = Helper.toHex(newValue);
                                        gui.cachedQuerySelector(selector + ' span.dec').textContent = newValue;
                                    } else {
                                        c.innerHTML = Helper.numberToString(cid, i + 1, newValue, true, 2);
                                    }
                                }

                                switch(mode) {
                                    case 1: // ignore
                                        ignore[cid + '_b' + (i + 1)] = true;
                                        c.parentNode.classList.add('ignored');
                                        break;
                                    case 0: // normal

                                        gui.updateCarStatus(cid, i + 1, newValue);

                                        if(!ignore.hasOwnProperty(cid) && !ignore.hasOwnProperty(cid + '_b' + (i + 1))) {
                                            c.parentNode.classList.add('changed');
                                            changedFields[selector] = 300; // noch 300ms einfärben

                                            // Wenn das Feld auf der Watchlist steht, dann Zeige die Änderung als Text an
                                            if (displayCANids.hasOwnProperty(cid) && displayCANids[cid].hasOwnProperty('b' + (i + 1)) && displayCANids[cid]['b' + (i + 1)]) {
                                                const bytesAsBin = [];
                                                for (let k = 0; k < values.length; k++)
                                                    bytesAsBin.push(Helper.numberToString(cid, i + 1, values[k], false, 2)); // ' <span title="0x' + values[k].toString(16).toUpperCase() + '">' + ("00000000"+values[k].toString(2)).slice(-8) + '</span>'
                                                details.innerHTML += '<br>' + cid + ", Byte " + (i + 1) + ": " + bytesAsBin.join(' | ');
                                                addedSthToDetails = true;
                                            }
                                        } else if(c.parentNode.classList.value.indexOf('ignored') < 0) {
                                            c.parentNode.classList.add('ignored');
                                        }
                                        break;
                                }
                            }
                        }
                    }
                    if(addedSthToDetails)
                        details.innerHTML += '<hr>';
                } else {
                    // create
                    const row = table.insertRow();
                    row.id = cid;
                    row.setAttribute('data-canid', cid);

                    const cBtns = row.insertCell(0);
                    cBtns.innerHTML = '<span onclick="gui.moveRowUp(this);" class="clickable">up</span>/<span onclick="gui.moveRowDown(this);" class="clickable">down</span>';

                    for(let i = 7; i >= 0; i--) {
                        const c = row.insertCell(0), values = data.sendDiff[cid][i];
                        c.setAttribute('data-canid', cid);
                        c.setAttribute('data-bytenr', i + 1 + '');
                        if(values.length) {
                            c.innerHTML = Helper.numberToString(cid, i + 1, values[values.length - 1], true);
                            values.length && gui.updateCarStatus(cid, i + 1, values[values.length - 1]);
                        }
                        c.innerHTML = '<span class="content">' + c.innerHTML + '</span><span class="buttons clickable" onclick="gui.newMessage(this)">M</span>';
                    }
                    const cID = row.insertCell(0);
                    const i   = parseInt(cid.replace(/canid_0x/, ''), 16);
                    cID.innerHTML = Helper.numberToString(cid, false, i, true, 3); // canID.toString(16).toUpperCase();

                    ignoreKnown();
                }
            }
        }
    } else {
        console.log("ERROR: %o", data);
    }
});

function isIgnored(cid, bytenr, mask) {
    if(!cid) return false;
    if(ignore.hasOwnProperty(cid) && ignore[cid]) return true;

    if(!bytenr) return false;
    if(ignore.hasOwnProperty(cid + '_b' + bytenr) && ignore[cid + '_b' + bytenr]) return true;

    if(!mask) return false;
    if(ignore.hasOwnProperty(cid + '_b' + bytenr + '_m' + mask) && ignore[cid + '_b' + bytenr + '_m' + mask]) return true;
}

let fs = null;

function getFS(callback) {
    if(fs) {
        callback && callback();
    } else {
        navigator.webkitPersistentStorage.requestQuota(1024*1024, function() {
            window.webkitRequestFileSystem(window.PERSISTENT , 1024*1024, function(filesystem) {
                fs = filesystem;

                callback && callback();
            });
        })
    }
}

function saveKnownToFile() {
    getFS(function() {
        fs.root.getFile("/known_test.json", {create: true}, function(file) {
            file.createWriter(function(inhalt) {
                const blob = new Blob([JSON.stringify(known)], {type: "application/json"});
                inhalt.write(blob);
                alert('Saved!');
            });
        });
    })
}

function readKnownFromFile() {
    getFS(function () {
        fs.root.getFile("/known_test.json", {}, function(fileEntry) {
            fileEntry.file(function(file) {
                const reader = new FileReader();
                reader.onloadend = function(e) {
                    const tmp = JSON.parse(e.target.result);
                    known = tmp;
                };
                reader.readAsText(file);
            });
        });
    })
}

function selectPort(port) {
    isRunning = true;
    socket.send({'select': port});
}

function stopPort() {
    isRunning = false;
    socket.send({'stop': true});
}

function resetLastValues() {
    socket.send({'resetLastValues': true});
}

function showPorts(ports, connected) {
    // 1. Nachricht => Liste aller Seriellen Ports
    serialports.innerHTML = "";
    let pCount = 0;
    for (const p in ports)
        if (ports.hasOwnProperty(p) && ports[p].comName.indexOf('USB') >= 0) {
            if(ports[p].comName !== connected)
                serialports.innerHTML += "<li style='text-decoration:underline;' onclick=\"selectPort('" + ports[p].comName + "')\">" + ports[p].comName + "</li>";
            else
                serialports.innerHTML += "<li title='STOP!' onclick='stopPort()'>" + ports[p].comName + "</li>";
            pCount++;
        }
    if (!pCount)
        serialports.innerHTML = '<li>No USB devices found</li>';
    serialports.innerHTML += "<li style='text-decoration:underline;' onclick=\"selectPort('file')\">File</li>";

    // if(connected === 'console')
    //     serialports.innerHTML += "<li title='STOP!' onclick='stopPort()'>Console</li>";
    // else
    //     serialports.innerHTML += "<li style='text-decoration:underline;' onclick=\"selectPort('console')\">Console</li>";

    if(connected === 'random')
        serialports.innerHTML += "<li title='STOP!' onclick='stopPort()'>Console</li>";
    else
        serialports.innerHTML += "<li style='text-decoration:underline;' onclick=\"selectPort('random')\">Random</li>";
}

Mousetrap.bind('alt+r v', resetLastValues);
Mousetrap.bind('alt+r d', function() {details.innerHTML="";});
Mousetrap.bind('alt+m', GUI.toggle_menubar);
Mousetrap.bind('alt+s', function() {
    if(!mode)
        ignoreStart();
    else
        ignoreStop();
});

readKnownFromFile();

function copyTextToClipboard(text) {
    const textArea = document.createElement("textarea");

    // Place in top-left corner of screen regardless of scroll position.
    textArea.style.position = 'fixed';
    textArea.style.top = 0;
    textArea.style.left = 0;

    // Ensure it has a small width and height. Setting to 1px / 1em
    // doesn't work as this gives a negative w/h on some browsers.
    textArea.style.width = '2em';
    textArea.style.height = '2em';

    // We don't need padding, reducing the size if it does flash render.
    textArea.style.padding = 0;

    // Clean up any borders.
    textArea.style.border = 'none';
    textArea.style.outline = 'none';
    textArea.style.boxShadow = 'none';

    // Avoid flash of white box if rendered for any reason.
    textArea.style.background = 'transparent';


    textArea.value = text;

    document.body.appendChild(textArea);

    textArea.select();

    try {
        const successful = document.execCommand('copy');
        const msg = successful ? 'successful' : 'unsuccessful';
        console.log('Copying text command was ' + msg);
    } catch (err) {
        console.log('Oops, unable to copy');
    }

    document.body.removeChild(textArea);
}