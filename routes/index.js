('use strict');

var express = require('express');
var router = express.Router();
const fs = require('fs');
var uniqid = require('uniqid');
var request = require('sync-request');

var cloudinary = require('cloudinary').v2;

cloudinary.config({
	cloud_name: process.env.CLOUD_NAME,
	api_key: process.env.CLOUD_API_KEY,
	api_secret: process.env.CLOUD_API_SECRET
});

const subscriptionKey = process.env.AZURE_KEY;

const uriBase =
	'https://westcentralus.api.cognitive.microsoft.com/face/v1.0/detect';

function capitalize(str) {
	return str[0].toUpperCase() + str.slice(1).toLowerCase();
}

// POST UPLOAD A PICTURE
router.post('/upload', async function(req, res, next) {
	// 1) STOCKAGE IMAGE EN LOCAL
	var imagePath = `./tmp/${uniqid()}.jpg`;
	var resultCopy = await req.files.picture.mv(imagePath);

	// 2) UPLOAD CLOUDINARY
	if (!resultCopy) {
		var resultCloudinary = await cloudinary.uploader.upload(imagePath);

		// 3) ENVOI A AZURE
		const params = {
			returnFaceId: 'true',
			returnFaceLandmarks: 'false',
			returnFaceAttributes:
				'age,gender,headPose,smile,facialHair,glasses,' +
				'emotion,hair,makeup,occlusion,accessories,blur,exposure,noise'
		};

		const options = {
			// uri: uriBase,
			qs: params,
			body: '{"url": ' + '"' + resultCloudinary.secure_url + '"}',
			headers: {
				'Content-Type': 'application/json',
				'Ocp-Apim-Subscription-Key': subscriptionKey
			}
		};

		// 4) TRAITEMENT DE LA REPONSE
		var rawResponse = request('POST', uriBase, options);

		var jsonResponse = rawResponse.getBody();
		jsonResponse = JSON.parse(jsonResponse);

		console.log('SUCCESS');
		res.json({
			result: true,
			message: 'File uploaded!',
			data: {
				pictureURL: resultCloudinary.secure_url,
				gender: capitalize(jsonResponse[0].faceAttributes.gender),
				age: jsonResponse[0].faceAttributes.age,
				glasses:
					jsonResponse[0].faceAttributes.glasses === 'NoGlasses'
						? 'No glasses'
						: 'Wears glasses',
				beard:
					jsonResponse[0].faceAttributes.facialHair.beard <= 0.5
						? 'Bearded'
						: 'Not bearded',
				smile:
					jsonResponse[0].faceAttributes.smile <= 0.7
						? 'Smiles'
						: "Doesn't smile",
				hairColor: capitalize(
					jsonResponse[0].faceAttributes.hair.hairColor[0].color + ' hair'
				)
			}
		});
	} else {
		console.log('FAILED');
		res.json({ result: false, message: resultCopy });
	}

	// 5) SUPPRESSION DE L'IMAGE LOCALE
	fs.unlinkSync(imagePath);
});

module.exports = router;
