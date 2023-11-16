import express from "express";
import mysql from 'mysql2';
const app = express();
import StatsD from "node-statsd";

import {logger} from "../logger.js";
import { sequelize } from "../Config/userConfig.js";

app.use(express.json());


const client = new StatsD({
  errorHandler: function (error) {
    console.error("StatsD error: ", error);
  }
});



app.use((req, res, next) => {
  if (req.method !== 'GET') {

    res.setHeader('Cache-Control', 'no-cache','no-store','must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.status(503).json();
  }
  next();
});

app.get('/' , async (req,res) => {
    res.setHeader('Cache-Control', 'no-cache','no-store','must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // res.json({message:'Route Protected!'})
    await sequelize.authenticate();
    console.log({host: process.env.MYSQL_HOST,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE,});
    let isHealthy =false
    
  
  if (Object.keys(req.body).length !== 0) {
    
    res.status(400).json();
    return;
  }
  
  if (Object.keys(req.query).length !== 0) {
    
    res.status(400).json();
  return;
  }
  try {
      const connectiondb= await sequelize.sync()
      
          if (connectiondb) {
              isHealthy = true
          }else{
              isHealthy = false
          }
         console.log("Connected!");
        
          if(isHealthy){  
            
            res.setHeader('Cache-Control', 'no-cache','no-store','must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('X-Content-Type-Options', 'nosniff');
            client.increment('endpoint.healthz.hits');
            res.status(200).json();
            logger.info("Healthz endpoint up")
          }
          else{  
            console.log("Connection Interrupted!")  
              
            res.status(503).json();
          }
        }
          catch(error){
            res.status(503).json();
          }

            
          
        });
  

  export default app;
