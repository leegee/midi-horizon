const fs = require('fs');
const path = require('path');
const chai = require('chai');

const Horizon = require('../src/Horizon.mjs');
const logger = require('./Logger-test.mjs');
const expect = chai.expect;

describe('horizon', () => {
    describe('static methods', () => {
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