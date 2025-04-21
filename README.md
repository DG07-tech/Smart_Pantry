# Smart Pantry

Smart Pantry is a Node.js-based web application that helps users manage their pantry efficiently. Users can organize pantry items by category, track expiration dates, get smart recipe suggestions, and generate shopping lists for missing ingredients — all within a clean, user-friendly interface.

---

##  Features

- 📝 **CRUD Pantry Items**: Add, edit, and delete pantry items categorized for easy access.
- 📊 **Inventory Insights**: Visualize pantry data using Chart.js based on item categories.
- 🍽️ **Recipe Suggestions**: Get smart recipe ideas using available pantry items.
- 🔍 **Recipe Search**: Search for recipes using keywords or item names.
- 🛒 **Shopping List Generator**: Automatically create a shopping list based on missing ingredients.
- 📆 **Expiring Item Alerts**: View items that are about to expire within the next 7 days.
- 🔐 **User Authentication**: Secure login and registration using Passport.js.
- 🔑 **Google OAuth Integration**: Easily log in with your Google account.
- 🌐 **Responsive UI**: Built with HTML, CSS, Bootstrap, and EJS for a seamless experience across all devices.
- 📬 **Contact Us Form**: Users can reach out via a simple form powered by Web3Forms.
- ⚡ **Flash Messages**: Uses connect-flash to show success/error messages.

---

##  Tech Stack

- **Backend**: Node.js, Express.js
- **Frontend**: HTML, CSS, EJS, Bootstrap, Chart.js
- **Authentication**: Passport.js (Local + Google OAuth)
- **Validation**: Joi schema validation
- **Notifications**: connect-flash
- **API Integration**: Spoonacular API for recipe suggestions and shopping list generation
- **Contact Form**: Web3Forms
- **Database**: MongoDB (via Mongoose)

---

##  Project Structure

- **Landing Page**: A simple and clean introduction to the app.
- **User Dashboard**: Complete pantry management features after login.

---

##  Environment Variables

Create a `.env` file in the root directory and add the following:

```env
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
CONTACT_US_KEY
SPOONACULAR_RECIPIE_KEY
SESSION_SECRET
```
---

##  Installation

```bash
git clone https://github.com/DG07-tech/Smart_Pantry.git
```
```bash
cd Smart_Pantry
npm install
```
```bash
node app.js
```
Once the server is running, open your browser and navigate to:

http://localhost:3000




