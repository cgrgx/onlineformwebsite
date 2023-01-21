// import dependicies

const express = require('express');
const req = require('express/lib/request');
const path = require('path');
var myApp = express();
const session = require('express-session');

//Setup DB Connection
const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/awesomestore', {
    UseNewUrlParser: true,
    UseUnifiedTopology: true
});

// Setup DB Model
const Order = mongoose.model('order', {
    name: String,
    email: String,
    phone: String,
    postcode: String,
    lunch: String,
    tickets: Number,
    campus: String,
    subTotal: Number,
    tax: Number,
    total: Number
});

const Admin = mongoose.model('Admin', {
    username: String,
    password: String
});

//Setup Session
myApp.use(session({
    secret: 'thisismyrandomkeysuperrandomsecret',
    resave: false,
    saveUninitialized: true
}));

//Create Object Destructuring for Express Validator
const {
    check,
    validationResult
} = require('express-validator');
myApp.use(express.urlencoded({
    extended: true
}));

// Set path to public and views folder.
myApp.set('views', path.join(__dirname, 'views'));
myApp.use(express.static(__dirname + '/public'));
myApp.set('view engine', 'ejs');

//------------------- Validation Functions --------------------

var phoneRegex = /^[0-9]{3}\-?[0-9]{3}\-?[0-9]{4}$/; // 123-123-1234 OR 1231231234
var positiveNumber = /^[1-9][0-9]*$/;

function checkRegex(userInput, regex) {
    if (regex.test(userInput))
        return true;
    else
        return false;
}

function customPhoneValidation(value) {
    if (!checkRegex(value, phoneRegex)) {
        throw new Error('Please enter correct format: 123-123-1234 OR 1231231234!');
    }
    return true;
}

function customLunchAndTicketValidations(lunch, {
    req
}) {
    var tickets = req.body.tickets;
    if (!checkRegex(tickets, positiveNumber)) {
        throw Error('Please select tickets and tickets must be a positive number!');
    } else {
        tickets = parseInt(tickets);
        if (tickets < 3 && lunch != 'yes') {
            throw Error('Lunch is required, if you buy less than 3 tickets!');
        }
    }
    return true;
}

// Set up different routes (pages)

//Form (Home/Root) Page
myApp.get('/', function (req, res) {
    res.render('form');
    res.end();
});

myApp.post('/', [
    check('name', 'Name is required!').notEmpty(),
    check('email', 'Please enter a valid email address!').isEmail(),
    check('phone', '').custom(customPhoneValidation),
    check('lunch').custom(customLunchAndTicketValidations)
], function (req, res) {

    const errors = validationResult(req);
    console.log(errors);

    if (!errors.isEmpty()) {
        res.render('form', {
            errors: errors.array()
        });
    } else {
        //No Errors
        var name = req.body.name;
        var email = req.body.email;
        var phone = req.body.phone;
        var postcode = req.body.postcode;
        var lunch = req.body.lunch;
        var tickets = req.body.tickets;
        var campus = req.body.campus;

        var subTotal = tickets * 20;
        if (lunch == 'yes') {
            subTotal += 15;
        }

        var tax = subTotal * 0.13;
        var total = subTotal + tax;

        var pageData = {
            name: name,
            email: email,
            phone: phone,
            postcode: postcode,
            lunch: lunch,
            tickets: tickets,
            campus: campus,
            subTotal: subTotal,
            tax: tax,
            total: total
        }
    };

    //Create object for model-order
    var myOrder = new Order(pageData);

    //Save Order in MongoDB
    myOrder.save().then(function () {
        console.log('New Order Saved');
    });

    //Display the receipt output on form.
    res.render('form', pageData); // no need to add .ejs extension to the command.
    res.end();
});

//All Orders Page
myApp.get('/allorders', function (req, res) {
    //If session exists, then allow access to page.
    if (req.session.userLoggedIn) {
        //Read documents from MongDb
        Order.find({}).exec(function (err, orders) {
            console.log(err);
            console.log(orders);
            res.render('allorders', {
                orders: orders
            });
        });
    } else //Otherwise redirect user to login page.
    {
        res.redirect('/login');
    }
});

//Login Page
myApp.get('/login', function (req, res) {
    res.render('login');
});

myApp.post('/login', function (req, res) {
    var user = req.body.username;
    var pass = req.body.password;

    //console.log(`Username = ${user}`);
    //console.log(`Password = ${pass}`);

    Admin.findOne({
        username: user,
        password: pass
    }).exec(function (err, admin) {
        //Log any errors
        console.log(`Errors: ${err}`);
        console.log(`Admin: ${admin}`);

        if (admin) //If admin object exists - true
        {
            //Store username in session and set login in true.
            req.session.username = admin.username;
            req.session.userLoggedIn = true;
            //Redirect user to the All-Orders Page (Dashboard)
            res.redirect('/allorders');
        } else {
            //Display error if user info is incorrect
            res.render('login', {
                error: "Sorry Login Failed. Please try again!"
            });
        }

    });
});

//Logout Page
myApp.get('/logout', function (req, res) {
    req.session.username = "";
    req.session.userLoggedIn = false;
    res.render('login', {
        error: 'Successfully logged out!'
    });
});

//Delete Page
myApp.get('/delete/:id', function (req, res) {
    //Check if Session is established
    if (req.session.userLoggedIn) {
        //Perform delete operation
        var id = req.params.id;
        console.log("Id: " + id);
        Order.findByIdAndDelete({
            _id: id
        }).exec(function (err, order) {
            console.log(`Error: ${err}`);
            console.log(`Order: ${order}`);
            if (order) {
                res.render('delete', {
                    message: "Record Deleted Successfully!"
                });
            } else {
                res.render('delete', {
                    message: "Sorry, Record Not Deleted!"
                });
            }
        });
    } else
        //Otherwise redirect user to login page.
        res.redirect('/login');
});

//Edit Page
myApp.get('/edit/:id', function (req, res) {
    //Check if Session is established
    if (req.session.userLoggedIn) {
        //Perform edit operation
        var id = req.params.id;
        console.log("Id: " + id);
        Order.findOne({
            _id: id
        }).exec(function (err, order) {
            console.log(`Error: ${err}`);
            console.log(`Order: ${order}`);
            if (order) {
                res.render('edit', {
                    order: order
                });
            } else {
                res.render('edit', {
                    order: "No order found with this id!"
                });
            }
        });
    } else
        //Otherwise redirect user to login page.
        res.redirect('/login');
});

myApp.post('/edit/:id', [
    check('name', 'Name is required!').notEmpty(),
    check('email', 'Please enter a valid email address!').isEmail(),
    check('phone', '').custom(customPhoneValidation),
    check('lunch').custom(customLunchAndTicketValidations)
], function (req, res) {

    //Check if errors
    const errors = validationResult(req);
    console.log(errors);

    if (!errors.isEmpty()) {
        //Edit 
        var id = req.params.id;
        console.log(`Id: ${id}`);
        Order.findOne({
            _id: id
        }).exec(function (err, order) {
            console.log(`Error: ${err}`);
            console.log(`Order: ${order}`);
            if (order)
                res.render('edit', {
                    order: order,
                    errors: errors.array()
                });
            else
                res.send('No order was found with this id!');
        });
    } else {
        //No Errors
        var name = req.body.name;
        var email = req.body.email;
        var phone = req.body.phone;
        var postcode = req.body.postcode;
        var lunch = req.body.lunch;
        var tickets = req.body.tickets;
        var campus = req.body.campus;

        var subTotal = tickets * 20;
        if (lunch == 'yes') {
            subTotal += 15;
        }

        var tax = subTotal * 0.13;
        var total = subTotal + tax;

        var pageData = {
            name: name,
            email: email,
            phone: phone,
            postcode: postcode,
            lunch: lunch,
            tickets: tickets,
            campus: campus,
            subTotal: subTotal,
            tax: tax,
            total: total
        }
    };

    var id = req.params.id;
    Order.findOne({
        _id: id
    }).exec(function (err, order) {
        order.name = name;
        order.email = email;
        order.phone = phone;
        order.postcode = postcode;
        order.lunch = lunch;
        order.tickets = tickets;
        order.campus = campus;
        order.subTotal = subTotal;
        order.tax = tax;
        order.total = total;
        order.save();
    });

    //Display output: Updated Information
    res.render('editsuccess', pageData); // no need to add .ejs extension to the command.
    res.end();
});

//Author Page
myApp.get('/author', function (req, res) {
    res.render('author', {
        name: "admin",
        studentNumber: "324564"
    });
    res.end();
});

//Server Port Listen
myApp.listen(8081);
console.log('Everything executed fine... Open http://localhost:8081/');