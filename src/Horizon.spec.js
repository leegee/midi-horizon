const fs = require('fs');
const path = require('path');
const chai = require('chai');

const Horizon = require('./Horizon.mjs');

const expect = chai.expect;

describe('horizon', () => {

    describe('basics', () => {
        it('constructs', () => {
            const h = new Horizon({
                input: './test/images/london.jpg',
                output: './test/output/'
            });
            expect(h).to.be.an.instanceOf(Horizon);
        });
    });

    describe('scales velocity', () => {
        it('default 127', () => {
            const h = new Horizon({
                input: './test/images/london.jpg',
                output: './test/output/'
            });
            expect(h).to.be.an.instanceOf(Horizon);
            expect(h.velocityScaleMax, 'velocityScaleMax').to.equal(127);
            expect(h.scaleVelocity(255), 'scaled').to.equal(127);
            expect(h.scaleVelocity(127.5), 'scaled').to.equal(63);
        })

        it('at 100', () => {
            const h = new Horizon({
                input: './test/images/london.jpg',
                output: './test/output/',
                velocityScaleMax: 100
            });
            expect(h).to.be.an.instanceOf(Horizon);
            expect(h.velocityScaleMax, 'velocityScaleMax').to.equal(100);
            expect(h.scaleVelocity(255), 'scaled').to.equal(100);
            expect(h.scaleVelocity(127.5), 'scaled').to.equal(50);
        });
    });

    describe('highest notes', () => {
        const h = new Horizon({
            input: './test/images/london.jpg',
            output: './test/output/',
            x: 100,
            velocityScaleMax: 10,
            minVelocityPostScale: 2
        });


        it('should extract and save', async () => {
            await h.load();
            h._getPixels();
            h._linear();
            h._getHighestNotes();
            h._saveHighestNotes();
            expect(h.outputMidiPath).to.match(/_hi/g);
            expect(
                fs.existsSync(path.resolve(h.outputMidiPath)),
                h.outputMidiPath
            ).to.be.ok;
        });
    });

    xdescribe('resize', () => {
        const h = new Horizon({
            input: './test/images/london.jpg',
            output: './test/output/',
            x: 100,
            velocityScaleMax: 10,
            minVelocityPostScale: 2
        });

        it('should resize input image', async () => {
            await h.load();
            expect(h.img.bitmap.width).to.equal(h.staveX, 'x');
            expect(h.img.bitmap.height).to.equal(h.staveY, 'y');
        }).timeout(60 * 1000 * 2);

        it('should get image data', async () => {
            await h._getPixels();

            for (let x = 0; x < this.staveX; x++) {
                for (let y = 0; y < this.staveY; y++) {
                    expect(h.px[x][y]).not.to.be.undefined;
                }
            }
        });

        it('linear should produce MIDI data', () => {
            h._linear();
        });

        it('should save a .mid file', () => {
            const savedAt = h._saveAsOneTrack();
            expect(
                fs.existsSync(path.resolve(savedAt)),
                savedAt
            ).to.be.true;
        });
    });

    xdescribe('static methods', () => {
        describe('Horizon.dir2horizons', () => {
            it('runs', async () => {
                const horizons = await Horizon.dir2horizons({
                    input: './test/images/',
                    output: './test/output/',
                });
                expect(horizons).to.be.an.instanceOf(Array);
                expect(horizons).to.have.length.greaterThan(0);
            });
        });

        describe('Horizon.doDir', () => {
            it('runs', async () => {
                const horizons = await Horizon.doDir({
                    input: './test/images',
                    output: './test/output',
                });
                expect(horizons).to.be.an.instanceOf(Array);
                expect(horizons).to.have.length.greaterThan(0);
                horizons.forEach(h => {
                    expect(
                        fs.existsSync(path.resolve(h.outputMidiPath))
                    ).to.be.ok;

                });
            }).timeout(60 * 1000 * 2 * 7);
        });
    });

});