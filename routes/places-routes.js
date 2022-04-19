const express = require('express');
const { check } = require('express-validator');

const placesControllers = require('../controllers/places-controllers');
const fileUpload = require('../middleware/file-upload');
const checkAuth = require('../middleware/check-auth');

const router = express.Router();



router.get('/:pid', placesControllers.getPlaceById);

router.get('/user/:uid', placesControllers.getPlacesByUserId);

// poniższy middleware musi być w tym miejscu bo: requesty są czytane od góry do doły. Dwa powyższe get będą działały zawsze. te poniżej tylko wtedy gdy będzie token, dlatego że zanim do nich dotrze request to trafi najpierw na router.use(), który chce tokena
router.use(checkAuth);

router.post('/', fileUpload.single('image'),
    [
        check('title')
            .not()
            .isEmpty(),
        check('description')
            .isLength({ min: 5 }),
        check('address').not().isEmpty()
    ],
    placesControllers.createPlace);

router.patch('/:pid', [
    check('title')
        .not()
        .isEmpty(),
    check('description')
        .isLength({ min: 5 }),
], placesControllers.updatePlace);

router.delete('/:pid', placesControllers.deletePlace);

module.exports = router;