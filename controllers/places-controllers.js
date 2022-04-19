const fs = require('fs');


const { validationResult } = require('express-validator');
const mongoose = require('mongoose');

const HttpError = require('../models/http-error');
const getCoordsForAddress = require('../util/location');
const Place = require('../models/place');
const User = require('../models/user');


const getPlaceById = (req, res, next) => {
    const placeId = req.params.pid;
    let place;
    place = Place.findById(placeId)
        .then(result => {
            return place = result
        })
        .then(place => {
            return place = place;
        })
        .then(() => {
            return res.json({ place: place.toObject({ getters: true }) }); //zamieniamy obiekt DB na zwykły obiekt JS, getters pozbywa się _ z id
        })
        .catch(err => {
            const error = new HttpError('Something went wrong.', 500);
            return next(error);
        })

    if (!place) {
        // const error = new Error('Could not find a place for a provided id');
        // error.code = 404;
        // throw error;    // throw error zadziała tylko dla synchornicznego kodu. Inaczej stosuj next(error)

        // opcja 2 - jeśli zbuduję model/klasę Error, to mogę ją stosować

        // throw new HttpError('Could not find a place for a provided id', 404);
        const error = new HttpError('Could not find a place for a provided id', 404);
        return next(error);
    };

};



const getPlacesByUserId = async (req, res, next) => {
    const userId = req.params.uid;

    //OOPCJA PIERWSZA!

    // let places;
    // try {
    //     places = await Place.find({ creator: userId });
    // } catch (err) {
    //     const error = new HttpError('Fetching data failed', 500);
    //     return next(error);
    // }

    // if (!places || places.length === 0) {
    //     // const error = new Error('Could not find places for a provided user id');
    //     // error.code = 404;
    //     // return next(error);

    //     // opcja z modelem błędu 
    //     return next(new HttpError('Could not find a place for a provided user id', 404));
    // };

    // res.json({ places: places.map(place => place.toObject({ getters: true })) });

    // OPCJA DRUGA

    let userWithPlaces;
    try {
        userWithPlaces = await User.findById(userId).populate('places');
    } catch (err) {
        const error = new HttpError('Fetching data failed', 500);
        return next(error);
    }

    if (!userWithPlaces || userWithPlaces.places.length === 0) {
        // const error = new Error('Could not find places for a provided user id');
        // error.code = 404;
        // return next(error);

        // opcja z modelem błędu 
        return next(new HttpError('Could not find a place for a provided user id', 404));
    };

    res.json({ places: userWithPlaces.places.map(place => place.toObject({ getters: true })) });
};


const createPlace = async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return next(new HttpError('Invalid inputs!!!', 422));
    }

    const { title, description, address } = req.body;

    let coordinates;
    try {
        coordinates = await getCoordsForAddress(address);
    } catch (error) {
        return next(error);
    }

    const createdPlace = new Place({
        title,
        description,
        image: req.file.path,
        address,
        location: coordinates,
        creator: req.userData.userId          //można creatora wyciągnąć z body, alt to jest bezpieczniejsze. Zmieniono po dodaniu autoryzacji
    });

    let user;
    try {
        user = await User.findById(req.userData.userId); //można creatora wyciągnąć z body, alt to jest bezpieczniejsze. Zmieniono po dodaniu autoryzacji
    } catch (err) {
        const error = new HttpError(
            'Creating this place failed!!!!', 500);
        return next(error);
    }

    if (!user) {
        const error = new HttpError(
            'Could not find such user.', 404);
        return next(error);
    }



    try {
        // Muszą wydażyć się dwie rzeczy: createdPlace ma być dodane do bazy i odpowiedni user przyporządkowany do miejsca. Jeśli OBIE te rzeczy się powiodą dopiero wtedy jest sukces. Stąd tworzymy sesje i transakcję

        const sess = await mongoose.startSession();
        sess.startTransaction();
        await createdPlace.save({ session: sess });
        user.places.push(createdPlace);  //to push to nie jest push JS tylko metoda mongoDB, która doda id createdPlace do danego usera
        await user.save({ session: sess })  // {session: sess} znaczy aktualną session jest nasza sess
        await sess.commitTransaction(); //znaczy: tylko jeśli obie rzeczy się powidą commituj transakcję inaczej undo everything
    } catch (err) {
        const error = new HttpError(
            'Creating this place failed', 500);
        return next(error);
    }

    res.status(201).json({ place: createdPlace, message: 'I have created a new place' });
};



const updatePlace = async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return next(new HttpError('Invalid inputs!', 422));
    }
    const { title, description } = req.body;
    const placeId = req.params.pid;

    let place;
    try {
        place = await Place.findById(placeId);
    } catch (err) {
        const error = new HttpError('Could not update the place', 500);
        return next(error);
    };

    if (place.creator.toString() !== req.userData.userId) {
        const error = new HttpError('You are not allowed to edit this place!', 401);
        return next(error);
    }

    place.title = title;
    place.description = description;

    try {
        await place.save();
    } catch (err) {
        const error = new HttpError('Could not update the place', 500);
        return next(error);
    };

    res.status(200).json({ place: place.toObject({ getters: true }) });
};


const deletePlace = async (req, res, next) => {
    const placeId = req.params.pid;

    let place;
    try {
        place = await Place.findById(placeId).populate('creator'); //przeszuka też User czy u nie go nie ma place o takim id /bo creator tak naprawdę to id tego kto stworzył ten place

    } catch (err) {
        const error = new HttpError('Could not find the place', 500);
        return next(error);
    };

    if (!place) {
        const error = new HttpError('Could not find the place for the id ', 404);
        return next(error);
    }

    if (place.creator.id !== req.userData.userId) {
        const error = new HttpError('You are not allowed to delete this place.', 401);
        return next(error);
    }

    const imagePath = place.image;

    try {
        const sess = await mongoose.startSession();
        sess.startTransaction();
        await place.remove({ session: sess });
        place.creator.places.pull(place); //pull nie jest JS tylko z MOngoDB
        await place.creator.save({ session: sess });
        await sess.commitTransaction();
    } catch (err) {
        const error = new HttpError('Could not delete the place!', 500);
        return next(error);
    };

    fs.unlink(imagePath, err => {
        console.log(err);
    });

    res.status(200).json({ message: 'Place deleted' })
};


exports.getPlaceById = getPlaceById;
exports.getPlacesByUserId = getPlacesByUserId;
exports.createPlace = createPlace;
exports.updatePlace = updatePlace;
exports.deletePlace = deletePlace;