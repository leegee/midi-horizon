const chai = require('chai');

const Horizon = require('../src/Horizon.mjs');

const logger = require('./Logger-test.mjs');
const expect = chai.expect;
chai.use(require('chai-fs'));

xdescribe('color - details of la', () => {
    const h = new Horizon({
        input: './test/images/la.jpg',
        output: './test/output/',
        logger: logger,
        contrast: 0.8
    });


    it('note2chord', () => {
        expect(h.chords).to.be.instanceOf(Array);
        expect(h.chords.length).to.equal(h.scale.length);
    });

    it('note2chord floor', () => {
        expect(h._colour2chordName(0)).to.equal('Am');
    });

    it('note2chord ceil', () => {
        expect(h._colour2chordName(0.9814814814814814)).to.equal('G');
    });

    it('loads a colour image', async () => {
        await h.load();
        expect(h.colourImage).not.to.be.undefined;

        h._getPixels();
        expect(h.colours[0][0]).to.be.ok;
        h._linear();
        expect(h.notes[0][0]).to.be.ok;

    });

    it('gets a colour pixel', () => {
        h._getHighestNotes();
        expect(h.highestNotes.length).to.be.greaterThan(0);
        expect(h.colours[0][0]).not.to.be.undefined;

        h._processColours();

        expect(h.highestNotes.length).to.be.greaterThan(0);
        expect(h.averageColourChords.length).to.be.greaterThan(0);

        expect(h.averageColourChords[0].pitch).to.be.an.instanceOf(Array);
        expect(h.averageColourChords[0].pitch).to.have.length.greaterThan(0);

        h._saveColouredHighestNotes();

        expect(h.outputMidiPath).to.match(/_coloured\.mid$/);

        expect(
            h.outputMidiPath
        ).to.be.a.file(h.outputMidiPath);


        let pitchCount = {};
        h.highestNotes.forEach(note => {
            pitchCount[note.pitch] = pitchCount[note.pitch] ? pitchCount[note.pitch] + 1 : 1;
        });
        // console.log(pitchCount);
        expect(Object.keys(pitchCount).length).to.be.greaterThan(5); // XXX Arb fitness
    });
});

describe('does more files', () => {
    const imageNames = ['leeds', 'liverpool', 'hills']
    imageNames.forEach(name => {
        it(name, async () => {
            logger.level = 'trace';
            const h = new Horizon({
                input: './test/images/' + name + '.jpg',
                output: './test/output/',
                scale: 'major',
                logger
            });
            await h.load();
            h.doColours();
        }).timeout(3000);
    });
});