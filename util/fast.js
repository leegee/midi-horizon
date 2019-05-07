const chai = require('chai');

const Horizon = require('../src/Horizon.mjs');
const logger = require('./Logger-test.mjs');

const expect = chai.expect;
chai.use(require('chai-fs'));

Bresenham_Points = [
    [3, 0],
    [0, 3],
    [-3, 0],
    [0, -3],
    [3, 1],
    [1, 3],
    [-3, 1],
    [-1, 3],
    [-3, -1],
    [-1, -3],
    [1, -3],
    [2, 2],
    [-2, 2],
    [2, -2],
];

describe('general', () => {
    const h = new Horizon({
        input: './test/images/london.jpg',
        output: './test/output/',
        logger: logger
    });

    describe('basics', () => {
        it('constructs', async () => {
            await h.load();

            for (let y = 0; y <= this.staveY; y++) {
                for (let x = 0; x <= this.staveY; x++) {
                    testBresenhamPoints(x, y);
                }
            }
        });
    });
});

const testBresenhamPoints = (x, y) => {
    return h.px[x][y] > h.bresenhamPointsThreshold
}

// https://en.wikipedia.org/wiki/Features_from_accelerated_segment_test#FAST-ER:_Enhanced_repeatability
// http://en.wikipedia.org/wiki/Midpoint_circle_algorithm
