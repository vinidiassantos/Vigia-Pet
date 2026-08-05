import { app } from 'nitron'

app.init({
  name: "Vigia Pet",
  packageId: "com.example.app",
  version: "1.0.0",
  entry: "index.html",
  orientation: "portrait",
  statusBar: true,
  permissions: ["INTERNET"]
})
