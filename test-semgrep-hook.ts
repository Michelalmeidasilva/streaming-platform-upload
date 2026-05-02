// This file intentionally contains issues to test semgrep detection

// Using innerHTML with user input (XSS vulnerability)
const userInput = "test";
const div = document.createElement('div');
div.innerHTML = userInput;

// SQL query concatenation (SQL Injection)
const userId = "123";
const sqlQuery = "SELECT * FROM users WHERE id = '" + userId + "'";

// Weak crypto algorithm
import crypto from 'crypto';
const md5Hash = crypto.createHash('md5').update('password').digest('hex');
