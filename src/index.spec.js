const fs = require('fs');
const path = require('path');
const chai = require('chai');

const Horizon = require('./Horizon.mjs');

const expect = chai.expect;

describe('horizon', () => {

    describe('constructor', async () => {
        it('constructs', () => {
            const h = new Horizon({
                input: './test/london.jpg'
            });
            expect(h).to.be.an.instanceOf(Horizon);
        });
    });

    describe('resize', () => {
        const h = new Horizon({
            input: './test/london.jpg',
            x: 10
        });

        it('should resize input image', async () => {
            await h.prepare();

            expect(h.img.bitmap.width).to.equal(h.staveX, 'x');
            expect(h.img.bitmap.height).to.equal(h.staveY, 'y');
        }).timeout(60 * 1000 * 2);

        it('should get image data', async () => {
            await h.getData();

            for (let x = 0; x < this.staveX; x++) {
                for (let y = 0; y < this.staveY; y++) {
                    expect(h.px[x][y]).not.to.be.undefined;
                }
            }
        });

        it('should produce MIDI data', () => {
            h.linear();
        });

        it('should save a .mid file', () => {
            const savedAt = h.save();
            expect(
                fs.existsSync(path.resolve(savedAt))
            ).to.be.true;
        });
    });

    xdescribe('Horizon.dir2horizons', () => {
        it('runs', async () => {
            const horizons = await Horizon.dir2horizons({
                input: './test',
            });
            expect(horizons).to.be.an.instanceOf(Array);
            expect(horizons).to.have.length.greaterThan(0);
        });
    });

    xdescribe('Horizon.doDir', () => {
        it('runs', async () => {
            const horizons = await Horizon.doDir({
                input: './test',
            });
            expect(horizons).to.be.an.instanceOf(Array);
            expect(horizons).to.have.length.greaterThan(0);
            horizons.forEach(h => {
                expect(
                    fs.existsSync(path.resolve(h.outputMidi))
                ).to.be.true;

            });
        }).timeout(60 * 1000 * 2 * 7);
    })

});