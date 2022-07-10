# Database
A local JSON database for Node.js

## Installation
```bash
# NPM
npm i @pxe/database vlds 

# Yarn
yarn add @pxe/database vlds
```

## Usage
```ts
import Database from "@pxe/database";
import types from "vlds";

// Create a new database 
const db = new Database("/path/to/db");

// For TS type checking 
type UserType = { id: string, password: string };

// Create a new collection
const User = db.collect<UserType>("users", {
    id: types.string,
    password: types.string
});

// Create a new user 
const user = new User({
    id: "t7348gun9vio",
    password: "38hbn0p0v"
});

// Save to database 
await user.save();

// Find user
const currentUser = User.findOne({
    id: "t7348gun9vio"
}); 
console.log(currentUser.data);

// Delete user
User.remove(currentUser.id);

// Remove the user collection
db.remove("users");

// Clear the database
db.clear();
```