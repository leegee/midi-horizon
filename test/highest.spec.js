const chai = require('chai');

const Horizon = require('../src/Horizon.mjs');

const logger = require('./Logger-test.mjs');
const expect = chai.expect;
chai.use(require('chai-fs'));

logger.level = 'trace';

const h = new Horizon({
    input: './test/images/dubai.jpg',
    output: './test/output/',
    x: 100,
    logger
});

describe('highest notes', () => {
    it('set minUnscaledVelocity', () => {
        h.minUnscaledVelocity = 0;
        expect(h.minUnscaledVelocity).to.equal(0);
    });

    describe('one column', () => {
        it('1st is above threshold', () => {
            h.minUnscaledVelocity = 0;
            h.staveX = 1;
            h.staveY = 2;
            h.notes = [
                [{ velocity: 0.1 }],
                [{ velocity: 0.2 }],
            ]

            h._getHighestNotes();

            expect(h.highestNotes.length).to.equal(1);
            expect(h.highestNotes[0].velocity).to.equal(0.1);
        });

        it('2nd is above threshold', () => {
            h.minUnscaledVelocity = 0.2;
            h.staveX = 1;
            h.staveY = 2;
            h.notes = [
                [
                    { velocity: 0.1 },
                    { velocity: 0.2 }
                ],
            ]

            h._getHighestNotes();

            expect(h.highestNotes.length).to.equal(1);
            expect(h.highestNotes[0].velocity).to.equal(0.2);
        });
    });

    it('run', async () => {
        const h = new Horizon({
            input: './test/images/dubai.jpg',
            output: './test/output/',
            x: 100,
            logger
        });

        await h.load();
        expect(h.img.bitmap.width).to.equal(h.staveX);
        expect(h.img.bitmap.height).to.equal(h.staveY);

        h._getPixels();
        h._linear();
        h._getHighestNotes();
        h._saveHighestNotes();

        expect(h.outputMidiPath, 'midi path').to.match(
            /test[\\\/]output[\\\/]dubai\.jpg_hi\.mid$/
        );

        expect(
            h.outputMidiPath
        ).to.be.a.file(h.outputMidiPath);

        expect(
            h.highestNotes.some(
                n => typeof n !== 'undefined'
            )
        ).to.be.true;

        expect(
            h.highestNotes.every(
                n => h.highestNotes[0] && n && n.velocity === h.highestNotes[0].velocity
            )
        ).to.be.false;

        let pitchCount = {};
        h.highestNotes.forEach(note => {
            pitchCount[note.pitch] = pitchCount[note.pitch] ? pitchCount[note.pitch] + 1 : 1;
        });
        // console.log(pitchCount);
        expect(pitchCount).to.be.greaterThan(5); // XXX Arb fitness
    });
});

