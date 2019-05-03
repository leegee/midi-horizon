const MidiWriter = require('midi-writer-js');
const track = new MidiWriter.Track();

track.addTrackName('Colours ' + this._inputFilename);
track.setTimeSignature(1, 1);

track.addEvent(
    new MidiWriter.NoteEvent({
        velocity: 1,
        duration: 'T100', // 'T15', // 'T1584'
        pitch: ['D4', 'F4', 'A4'],
        startTick: 0
    })
);

new MidiWriter.Writer(track)
    .saveMIDI('temp');