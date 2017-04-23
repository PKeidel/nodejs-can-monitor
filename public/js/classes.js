class MyChart {
    constructor(id) {
        this.data = [
            ['x'],
            ['data1']
        ];
        this.chart = c3.generate({
            bindto: '#' + id,
            data: {
                x: 'x',
                xFormat: '%Y-%m-%dT%H:%M:%S.%LZ',
                columns: [
                    ['x'],
                    ['data1']
                ]
            },
            axis: {
                x: {
                    type: 'timeseries',
                    tick: {
                        format: '%Y-%m-%d'
                    }
                }
            }
        });
    }
    add(x, y) {

        // 300 samples => 5 minutes
        while(this.data[0].length > 300) {
            // save first values
            const t1 = this.data[0].shift();
            const t2 = this.data[1].shift();
            // remove second row
            this.data[0].shift();
            this.data[1].shift();
            // insert first values (captions) again
            this.data[0].unshift(t1);
            this.data[1].unshift(t2);
        }

        this.data[0].push(new Date().toISOString());
        this.data[1].push(y);
        this.chart.load({
            columns: this.data
        });
    }
}

class HTTP {
    static get(url, callback) {
        const xmlhttp = new XMLHttpRequest();
        xmlhttp.onreadystatechange = function() {
            if (this.readyState === 4 && this.status === 200)
                callback(this.responseText);
        };
        xmlhttp.open("GET", url, true);
        xmlhttp.send();
    }
}

class Helper {
    static toBin(i) {
        return ("00000000" + i.toString(2)).slice(-8);
    }
    static toHex(i, places) {
        places = places || 2;
        return '0x' + ("00" + i.toString(16)).slice(-places).toUpperCase();
    }
    static numberToString(cid, byteNr, value, br, places) {
        places = places || 2;
        br = br ? '<br>' : ' ';
        const hex = byteNr ? '<span class="clickable hex" onclick="gui.cellClicked(\'' + cid + '\', ' + byteNr + ')">' + Helper.toHex(value, places) + '</span>' : Helper.toHex(value, places);
        return '<i class="bin">' + Helper.toBin(value) + '</i>' + br + hex + ' (<span class="dec">' + value + '</span>)';
    }
    static getKnownText(canid, bytePosition, byteValue) {
        return 'TODO: hier muss noch was hin'
    }
}

class GUI {
    constructor() {
        this.savedQuerys = {};
        const that = this;

        // update Chart every second
        setInterval(function () {
            if(!isRunning)
                return;

            chart.add(seconds, messageCount[seconds]);

            seconds++;
        }, 1000);

        // remove 'changed' class every 150ms
        setInterval(function() {
            for(const key in changedFields) {
                if(changedFields.hasOwnProperty(key)) {
                    delete changedFields[key];
                    that.cachedQuerySelector(key).parentNode.classList.remove('changed');
                }
            }
        }, 150);
    }
    cachedQuerySelector(sel, all) {
        return this.savedQuerys[sel] || (this.savedQuerys[sel] = all ? document.querySelectorAll(sel) : document.querySelector(sel));
    }

    // replaces: ${cid}, ${byteNr}, ${value}
    updateCarStatus(cid, byteNr, value) {
    const statusID = cid + '-' + byteNr;

    // if(cid === 'canid_0x4F0' && byteNr === 2) {
    //     gaugeChart.load({
    //         columns: [['data', Math.round(value / 1.88 * 10) / 10]]
    //     });
    // }

    if(!known.hasOwnProperty(cid) || !known[cid].hasOwnProperty('byte_' + byteNr))
        return;

    // Bitmask
    for(let mask in known[cid]['byte_' + byteNr]) {
        if(known[cid]['byte_' + byteNr].hasOwnProperty(mask)) {
            const obj = known[cid]['byte_' + byteNr][mask];
            const mskStr = mask.replace(/mask_/, '');
            const msk = parseInt(mskStr, 2);
            const currentValue = (msk & value).toString(2);

            let eleID = 'status_' + statusID + '_' + mskStr, div = document.querySelector('#carstatus #' + eleID);
            if(!div) {
                div = document.createElement('span');
                div.id = eleID;
                div.title = cid + ', Byte: ' + byteNr + ', mask: ' + mskStr;
                div.classList.add('carstatus');
                document.querySelector('#carstatus').appendChild(div);
            }
            div.innerHTML = '';

            let txt = obj.text + ': ';
            if(obj.values && obj.values.hasOwnProperty(currentValue))
                txt += obj.values[currentValue];
            else if(obj.hasOwnProperty('display')) {
                try {
                    txt += eval('Math.round(' + replaceString(obj.display, {value: value}) + ' * 10) / 10');
                } catch(e) {
                    console.error("Fehler beim eval von: Math.round(" + replaceString(obj.display, {value: value}) + " * 10) / 10");
                }
            } else
                txt += '(' + Helper.toBin(currentValue) + ') -unknown-';

            if(obj.unit)
                txt += ' ' + obj.unit;

            div.innerHTML += txt + '<br>';
        }
    }
}

    toggle_updateIgnoredValues() {
        updateIgnoredValues = !updateIgnoredValues;
    }

    toggle_valueIsFloating() {
        valueIsFloating = !valueIsFloating;
        selectBit();
    }

    toggle_menubar() {
        if(this.cachedQuerySelector('div.menu-bar').classList.contains('closed'))
            this.cachedQuerySelector('div.menu-bar').classList.remove('closed');
        else
            this.cachedQuerySelector('div.menu-bar').classList.add('closed');
    }

    cellClicked(cid, byte) {
        const ele = document.querySelector('#' + cid + ' td:nth-child(' + (byte + 1) + ')');
        if(event.ctrlKey) {
            // Toggle Ignore
            if(byte === -1) {
                // Klick auf CanID => Gesamte CanID
                if (ignore.hasOwnProperty(cid) && ignore[cid]) {
                    delete ignore[cid];
                    ele.classList.remove('ignored');
                } else if (!ignore.hasOwnProperty(cid)) {
                    ignore[cid] = true;
                    ele.classList.add('ignored');
                }
            } else {
                if(ignore.hasOwnProperty(cid + '_b' + byte) && ignore[cid + '_b' + byte]) {
                    delete ignore[cid + '_b' + byte];
                    ele.classList.remove('ignored');
                } else if(!ignore.hasOwnProperty(cid + '_b' + byte)) {
                    ignore[cid + '_b' + byte] = true;
                    ele.classList.add('ignored');
                }
            }
        } else {
            // Toggle Watch
            displayCANids[cid] = displayCANids[cid] || {};
            if(displayCANids.hasOwnProperty(cid) && displayCANids[cid].hasOwnProperty('b' + byte)) {
                delete displayCANids[cid]['b' + byte];
                ele.classList.remove('watched');
            } else {
                displayCANids[cid]['b' + byte] = true;
                ele.classList.add('watched');
            }
        }
    }

    ignoreStart() {
    mode = 1;
    btnIgnoreStop.removeAttribute('disabled');
    btnIgnoreStart.setAttribute('disabled', 'true');
}

    ignoreStop() {
    mode = 0;
    btnIgnoreStop.setAttribute('disabled', 'true');
    btnIgnoreStart.removeAttribute('disabled');
}

    moveRowUp(ele) {
    const currentRow = ele.parentElement.parentElement;
    const previousRow = ele.parentElement.parentElement.previousElementSibling;
    currentRow.parentElement.insertBefore(currentRow, previousRow);
}

    moveRowDown(ele) {
    const currentRow = ele.parentElement.parentElement;
    const nextRow = ele.parentElement.parentElement.nextElementSibling; // previousElementSibling
    currentRow.parentElement.insertBefore(nextRow, currentRow);
}

    save_newMessage() {
    const cid = 'canid_' + gui.cachedQuerySelector('#newmessage .cid').textContent;
    const bytenr = 'byte_' + gui.cachedQuerySelector('#newmessage .byte').textContent;
    const mask = 'mask_' + gui.cachedQuerySelector('#newmessage .mask').textContent;
    const text = gui.cachedQuerySelector('#newmessage #label').value;

    // 1. Check if known[cid] exists
    if(!known.hasOwnProperty(cid))
        known[cid] = {};

    // 2. Check if known[cid][byte_*] exists
    if(!known[cid].hasOwnProperty(bytenr))
        known[cid][bytenr] = {};

    // 3. Check if known[cid][byte_*][mask_*] exists
    // => override existing
    // if(!known[cid][bytenr].hasOwnProperty(mask)) {
    known[cid][bytenr][mask] = {};
    known[cid][bytenr][mask].text = text;
    // }

    if(valueIsFloating) {
        known[cid][bytenr][mask].display = gui.cachedQuerySelector('#newmessage #newDisplay').value;
    } else {
        const values = gui.cachedQuerySelector('#newmessage .newMessageValues', true);
        if(values.length) {
            known[cid][bytenr][mask].values = {};
            for(let i = 0; i < values.length; i++) {
                known[cid][bytenr][mask].values[values[i].getAttribute('data-value')] = values[i].value;
            }
        }
    }

    ignoreKnown();

    gui.cachedQuerySelector('#newmessage').classList.add('hidden');

    saveKnownToFile();
}

    selectBit(bytenr) {
    // 1. Toggle Bit in mask
    if(bytenr)
        gui.cachedQuerySelector('#newmessage .mask span:nth-child(' + bytenr + ')').textContent = +!+gui.cachedQuerySelector('#newmessage .mask span:nth-child(' + bytenr + ')').textContent;

    // 2. calculate new Value
    const value = parseInt(gui.cachedQuerySelector('#newmessage .bin').innerText, 2);
    const mask = parseInt(gui.cachedQuerySelector('#newmessage .mask').innerText, 2);
    const newValue = value & mask;
    gui.cachedQuerySelector('#newmessage .newhex').textContent = Helper.toHex(newValue);
    gui.cachedQuerySelector('#newmessage .newdec').textContent = newValue;

    // 3. remove old dynamicly added rows
    const dynamics = document.querySelectorAll('#newmessage table .dynamic');
    for(let i = 0; i < dynamics.length; i++)
        dynamics[i].parentNode.removeChild(dynamics[i]);

    if(valueIsFloating) {
        // display-Formel eingeben
        const row = gui.cachedQuerySelector('#newmessage table').insertRow();
        row.classList.add('dynamic');

        // 1. Label
        const cel1 = row.insertCell();
        cel1.textContent = 'Display:';
        cel1.setAttribute('colspan', 2);
        cel1.style['text-align'] = 'right';

        // 2. empty
        row.insertCell();

        // 3. Textfield
        const cel3 = row.insertCell();
        cel3.innerHTML = '<input type="text" id="newDisplay" value="${value} * 2" />';
        return;
    }

    addDynamicRow(0);

    if(!mask || mask === 0)
        return;

    // 4. show all possible values
    let added = {};
    for(let i = 0; i <= 255; i++) {
        if((mask & i) > 0 && !added.hasOwnProperty(mask & i)) {
            added[mask & i] = true;
            addDynamicRow((mask & i));
        }
    }
}

    addDynamicRow(i) {
    const row = gui.cachedQuerySelector('#newmessage table').insertRow();
    row.classList.add('dynamic');

    // 1. Label
    const cel1 = row.insertCell();
    cel1.textContent = 'Value:';
    cel1.setAttribute('colspan', 2);
    cel1.style['text-align'] = 'right';

    // 2. Value
    const cel2 = row.insertCell();
    cel2.textContent = Helper.toBin(i).split('').join(' ');

    // 3. Textfield
    const cel3 = row.insertCell();
    cel3.innerHTML = '<input type="text" class="newMessageValues" data-value="' + Helper.toBin(i).replace(/^[0]{0,7}/, '') + '" />';
}

    newMessage(ele) {
    const currentRow = ele.parentElement;
    const cid = currentRow.getAttribute('data-canid');
    const bytenr = currentRow.getAttribute('data-bytenr');
    const value = parseInt(ele.parentElement.children[0].children[0].textContent, 2);

    cachedQuerySelector('#newmessage .cid').textContent = cid.replace(/canid_/, '');
    cachedQuerySelector('#newmessage .byte').textContent = bytenr;
    cachedQuerySelector('#newmessage .hex').textContent = Helper.toHex(value);
    cachedQuerySelector('#newmessage .dec').textContent = value;

    // Binary clickable
    cachedQuerySelector('#newmessage .bin').textContent = '';
    cachedQuerySelector('#newmessage .mask').textContent = '';
    const binstr = Helper.toBin(value);
    for(let i = 0; i < binstr.length; i++) {
        cachedQuerySelector('#newmessage .bin').innerHTML  += '<span onclick="selectBit(' + (i + 1) + ')" data-bytenr="' + (i + 1) + '">' + binstr[i] + '</span>';
        cachedQuerySelector('#newmessage .mask').innerHTML += '<span onclick="selectBit(' + (i + 1) + ')" data-bytenr="' + (i + 1) + '">0</span>';
    }

    selectBit();

    changed_collectForMs(1000);

    newmessage.classList.remove('hidden');
}

}