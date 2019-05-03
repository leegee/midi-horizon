const chai = require('chai');

const Horizon = require('../src/Horizon.mjs');

const logger = require('./Logger-test.mjs');
const expect = chai.expect;
chai.use(require('chai-fs'));

let note, h;

beforeEach(() => {
    h = new Horizon({
        input: './test/images/la.jpg',
        output: './test/output/',
        logger: logger
    });
    note = {
        duration: 1,
        velocity: 0.5,
        pitch: 'B'
    },
        otherNote = {
            duration: 1,
            velocity: 1,
            pitch: 'C'
        }

});

describe('sustain', () => {
    [2, 3, 100].forEach(length => {
        it(length + ' units', () => {
            h.averageColourChords = [];
            for (let i = 0; i < length; i++) {
                h.averageColourChords.push(Object.assign({}, note));
            }
            h._sustainAdjacentChords();
            expect(h.averageColourChords.length).to.equal(length);
            expect(h.averageColourChords[0]).not.to.be.undefined;
            expect(h.averageColourChords[0].duration).to.equal(length);
            expect(h.averageColourChords[length - 1]).to.be.undefined;
            expect(
                h.averageColourChords.slice(1, length - 1)
            ).to.deep.equals(new Array(length - 2));

        });
    });

    it('Different units', () => {
        const length = 10;
        h.averageColourChords = [];
        for (let i = 0; i < length; i++) {
            h.averageColourChords.push(Object.assign({}, note));
        }

        for (let i = 0; i < length; i++) {
            h.averageColourChords.push(Object.assign({}, otherNote));
        }

        for (let i = 0; i < length; i++) {
            h.averageColourChords.push(Object.assign({}, note));
        }

        h._sustainAdjacentChords();

        expect(h.averageColourChords.length).to.equal(length * 3);
        expect(h.averageColourChords[0]).not.to.be.undefined;
        expect(h.averageColourChords[0].duration).to.equal(length);
        expect(h.averageColourChords[0].pitch).to.equal('B');
        expect(h.averageColourChords[length - 1]).to.be.undefined;

        expect(
            h.averageColourChords.slice(1, length -1)
        ).to.deep.equals(new Array(length - 2));

        expect(h.averageColourChords[length]).not.to.be.undefined;
        expect(h.averageColourChords[length].pitch).to.equal('C');
        expect(h.averageColourChords[length].duration).to.equal(length);

    });

});


