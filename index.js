const createApp = require('./app')
const app = createApp()

app.listen(5000, () => console.log("Server Running on Port 5000"))
