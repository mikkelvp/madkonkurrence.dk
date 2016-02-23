#!/usr/bin/env node

'use strict';

/* SÆT DATA HER */
var userId = '12345'; // COOP medlemsnummer
var fullName = 'fuldt navn';
var address = 'vej 1';
var zip = '0000';
var city = 'by';
var phone = '12345678';
var email = 'e@mail.com';
var minWait = 2000; // Min antal millisekunder ventetid mellem koder sendes
var maxWait = 4000; // Max antal millisekunder


////////////////////////////////////////////////////////////////

var http = require('http');
var fs = require('fs');
var codes = fs.readFileSync('koder.txt').toString().split("\n");
var hostname = 'www.madkonkurrence.dk';
var count = 0;
var wins = 0;
var submittedWins = 0;
var timeToWait = 0;
var failedCodes = [];
var security;

console.log(codes.length + ' koder fundet.');

function start() {
    for (var i in codes) {
        codes[i] = codes[i].substr(0, 5);
        setTimeout(checkCode, timeToWait, codes[i]);
        timeToWait += getRandomInt(minWait, maxWait);
    }
    setInterval(end, 2000);
}

function getGlobalSecurity(callback) {
    var data = [];
    var options = {
        host: hostname,
        port: 80,
        path: '/'
    };
    http.get(options, function(res) {
        res.on("data", function(chunk) {
            data.push(chunk);
        });

        res.on('end', function() {
            var htmlString = data.join('');
            var indexOfSec = htmlString.indexOf('GlobalSecurity');
            var sec = htmlString.substr(indexOfSec);
            var arr = sec.split("'");
            security = arr[1];
            callback();
        });
    }).on('error', function(err) {
        console.log('failed to get GlobalSecurity variable');
        console.log(err);
        process.exit();
    });
}

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min)) + min;
}

function checkCode(code) {
    var data = [];
    var checkCodeQuestion = JSON.stringify({
        UserId: userId,
        Code: code,
        UserIdType: 'numbe',
        Security: security
    });
    var options = {
        hostname: hostname,
        path: '/api/CheckCode',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Content-Length': Buffer.byteLength(checkCodeQuestion)
        }
    };
    var req = http.request(options, function(res) {
        res.setEncoding('utf8');
        res.on('data', function(chunk) {
            data.push(chunk);

        });
        res.on('end', function() {
            var parsedData = JSON.parse(data.join(''));
            count++;
            if (parsedData.Message) {
                console.log(parsedData.Message + ' = muligt IP ban.');
                return;
            }
            console.log(count + ': ' + code + ': ' + parsedData.Status);
            if (parsedData.Status === 'WonFirstPrice' || parsedData.Status === 'WonSecondPrice') {
                console.log('Du har vundet: ' + parsedData.Price + ' Vinder ID: ' + parsedData.WinnerId);
                wins++;
                submitWinnerInfo(parsedData.WinnerId);
            }

        });
    });

    req.on('error', function(err) {
        failedCodes.push(code);
        console.log(code + ': Error.');
        console.log(err);
    });

    req.write(checkCodeQuestion);
    req.end();
}

function submitWinnerInfo(winnerId) {
    var reqData = JSON.stringify({
        WinId: winnerId,
        UserNumber: userId,
        FullName: fullName,
        Address: address,
        ZipCode: zip,
        City: city,
        Phone: phone,
        Email: email
    });
    var options = {
        hostname: hostname,
        path: '/api/profile',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Content-Length': Buffer.byteLength(reqData)
        }
    };
    var req = http.request(options, function(res) {
        res.setEncoding('utf8');
        res.on('data', function(chunk) {
            console.log(chunk);

        });
        res.on('end', function() {
            console.log('Vinderinfo sendt.');
            submittedWins++;
        });

        req.on('error', function(err) {
            console.log('ERROR:');
            console.log(err);
        });
        req.write(reqData);
        req.end();
    });
}

function end() {
    var _timeToWait = 0;
    if (failedCodes.length > 0) {
        console.log(failedCodes.length + ' failed. Retrying.');
        for (var i in failedCodes) {
            _timeToWait += getRandomInt(minWait, maxWait);
            setTimeout(checkCode, _timeToWait, failedCodes.pop());
        }
    } else if (count === codes.length && wins === submittedWins) {

        var data = [];
        var reqData = JSON.stringify({
            UserId: userId,
            UserIdType: "numbe",
        });
        var options = {
            hostname: hostname,
            path: '/api/MyKodes',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'Content-Length': Buffer.byteLength(reqData)
            }
        };
        var req = http.request(options, function(res) {
            res.setEncoding('utf8');
            res.on('data', function(chunk) {
                data.push(chunk);
            });
            res.on('end', function() {
                console.log('Du har nu ' + JSON.parse(data.join('')).length + ' lodder.');
                process.exit();
            });
        });

        req.on('error', function(err) {
            console.log('ERROR:');
            console.log(err);
        });
        req.write(reqData);
        req.end();

        console.log(count + ' koder sendt.');
        console.log(wins + ' wins.');
    }
}

getGlobalSecurity(start);