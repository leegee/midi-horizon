const fs = require('fs');
const path = require('path');
const chai = require('chai');

const Horizon = require('./Horizon.mjs');

const expect = chai.expect;

describe('horizon - highest notes', () => {

    describe('highest notes', () => {
        let h;

        it('should produce correct paths', () => {
            h = new Horizon({
                input: './test/images/london.jpg',
                output: './test/output/',
            });
            expect(h._inputFilename).to.equal('london.jpg');
            expect(h.outputImgPath, 'img path').to.match(
                /test[\\\/]output[\\\/]london\.jpg_tmp\.png$/
            );
            expect(h.outputMidiPath, 'midi path').to.match(
                /test[\\\/]output[\\\/]london\.jpg\.mid$/
            );
            expect(h._outputDir).to.match(/test[\\\/]output[\\\/]?/);
        });

        it('should extract and save', async () => {
            await h.load();
            h._getPixels();
            h._linear();
            h._getHighestNotes();
            h._saveHighestNotes();

            expect(h.outputMidiPath, 'midi path').to.match(
                /test[\\\/]output[\\\/]london\.jpg_hi\.mid$/
            );

            expect(
                fs.existsSync(h.outputMidiPath),
                h.outputMidiPath
            ).to.be.ok;
        });
    });
});

