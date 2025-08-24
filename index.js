const express = require('express');
const { NFC } = require('nfc-pcsc');
const http = require('http');
const { Server } = require('socket.io');
const ndef = require('ndef');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public')); // serve web page from /public

const nfc = new NFC();

nfc.on('reader', reader => {
    console.log(`${reader.reader.name} connected`);

    reader.on('card', async card => {
        console.log('Card detected:', card);

        // read first 16 bytes (example)
        try {
            const data = await reader.read(4, 16); // block 4, length 16
            console.log('Raw data:', data);

            // Try to decode as NDEF
            try {
                const ndefMessage = ndef.decodeMessage(data);
                console.log('Decoded NDEF:', ndefMessage);
                io.emit('tag-read', ndefMessage); // send to browser
            } catch {
                io.emit('tag-read', data.toString('utf8')); // fallback
            }
        } catch (err) {
            console.error('Read error:', err);
        }
    });

    reader.on('error', err => console.error('Reader error:', err));
    reader.on('end', () => console.log(`${reader.reader.name} disconnected`));
});

io.on('connection', socket => {
    console.log('Browser connected');

    // Listen for write requests from browser
    socket.on('write-tag', async text => {
        console.log('Writing tag:', text);

        nfc.on('reader', async reader => {
            const message = [ndef.textRecord(text)];
            const bytes = Buffer.from(ndef.encodeMessage(message));

            try {
                await reader.write(4, bytes, 16);
                console.log('✅ Tag written successfully');
                socket.emit('write-success', text);
            } catch (err) {
                console.error('❌ Write error:', err);
                socket.emit('write-fail', err.message);
            }
        });
    });
});

server.listen(3000, () => console.log('Server running on http://localhost:3000'));
