const mongoose = require('mongoose');
const redis = require("redis");
const util = require("util");

const redisUrl = "redis://127.0.0.1:6379";
const client = redis.createClient(redisUrl);
// this turns any function taking a callback into a promise.
client.get = util.promisify(client.get);


// We are using prototypal inheritance to "hijack" the exce function, so that we can add our cachin logic to it. The biggest lesson here is that you can hijack certain functions.

// Step 1) store the "hijacked" function in a variable with the same name.
const exec = mongoose.Query.prototype.exec;


// Step 2) redefine what the function does.
// Don't use an arrow function because arrow functions don't bind this. You will lose context when you pass the function off.
mongoose.Query.prototype.exec = async function () {
  // Object.assign takes the properties of the objects passed into it and assign it to the object in the first argument.
  // Here we create the key for the caching DB. It has to be unique and consistent.
  const key = JSON.stringify(Object.assign({}, this.getQuery(), { collection: this.mongooseCollection.name}));

  const cacheValue = await client.get(key);

  if (cacheValue) {
    return JSON.parse(cacheValue);
  }

  // we use apply so that we can pass in any arguements that passed in to exec as well.
  const result = await exec.apply(this, arguments);
  client.set(key, JSON.stringify(result));
  return result;
}