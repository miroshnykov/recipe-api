import {createServer} from "http";
import {Server, Socket} from "socket.io";
import 'dotenv/config';
import consola from "consola";

import express, {Application, Request, Response, NextFunction} from 'express'
import {setOffersRecipe} from "./crons/offersRecipe"
import {setFileSizeOffers} from "./crons/offersFileSize";
import {redis} from "./redis";
import {setCampaignsRecipe} from "./crons/campaignsRecipe";
import {setFileSizeCampaigns} from "./crons/campaignsFileSize";
import {encrypt, decrypt, getLocalFiles, getFileSize} from "./utils"

const app: Application = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {});
const host: string = process.env.HOST || ''
const port: number = Number(process.env.PORT || '3001')

// http://localhost:3001/encodeUrl?offerId=1111&campaignId=22222
app.get('/encodeUrl', async (req: Request, res: Response) => {
  try {
    const campaignId: number = Number(req.query.campaignId)
    const offerId = Number(req.query.offerId)

    let obj = {
      offerId,
      campaignId
    }
    let encodesUrl: string = JSON.stringify(obj);

    let encryptData: string = encrypt(encodesUrl)
    // consola.info('encryptData:', encryptData)
    const response = {
      encryptData
    }
    res.json(response)
  } catch (e) {
    consola.error(e)
    res.json({err: e})
  }

})

// http://localhost:3001/decodeUrl?code=
app.get('/decodeUrl', async (req: Request, res: Response) => {

  interface decodedObj {
    offerId: number
    campaignId: number
  }

  try {

    const code: string = String(req.query.code)
    const decodedString: string = decrypt(code)
    const formatCode: decodedObj = JSON.parse(decodedString!)

    res.json(formatCode)
  } catch (e) {
    consola.error(e)
    res.json({err: e})
  }
})

// http://localhost:3001/files
app.get('/files', async (req: Request, res: Response) => {
  try {
    let files = await getLocalFiles('/tmp/co-recipe')
    let filesFormat = []
    // @ts-ignore
    for (const file of files) {
      let filePath: string = `/tmp/co-recipe/${file}`
      let size = await getFileSize(filePath)
      filesFormat.push({file: filePath, size: size})
    }

    res.json(filesFormat)
  } catch (e) {
    res.json({err: e})
  }

})

// http://localhost:3001/fileSizeInfoRedis
app.get('/fileSizeInfoRedis', async (req: Request, res: Response) => {
  try {
    let fileSizeCampaignsRecipe: string | null = await redis.get(`campaignsSize`)
    let fileSizeOffersRecipe: string | null = await redis.get(`offersSize`)

    res.json({
      fileSizeCampaignsRecipe,
      fileSizeOffersRecipe
    })
  } catch (e) {
    res.json({err: e})
  }

})

io.on('connection', (socket: Socket) => {
  consola.success('connection');
  socket.on('fileSizeOffersCheck', async (fileSizeOffersCheck: number) => {
    try {
      // consola.info(`Get size from engine:${fileSizeOffersCheck}`)
      let fileSizeOffersRecipe: number = Number(await redis.get(`offersSize`))
      if (fileSizeOffersCheck !== fileSizeOffersRecipe) {
        consola.warn(`fileSize is different `)
        consola.info(`fileSizeOffersCheck:${fileSizeOffersCheck}, fileSizeOffersRecipe:${fileSizeOffersRecipe}`)
        io.to(socket.id).emit("fileSizeOffersCheck", fileSizeOffersCheck)
      }

    } catch (e) {
      consola.error('fileSizeOffersCheckError:', e)
    }
  })

  socket.on('fileSizeCampaignsCheck', async (fileSizeCampaignsCheck: number) => {
    try {
      let fileSizeCampaignsRecipe: number = Number(await redis.get(`campaignsSize`))
      if (fileSizeCampaignsCheck !== fileSizeCampaignsRecipe) {
        consola.warn(`fileSize campaigns  is different `)
        consola.info(`fileSizeCampaignsCheck:${fileSizeCampaignsCheck}, fileSizeCampaignsRecipe:${fileSizeCampaignsRecipe}`)
        io.to(socket.id).emit("fileSizeCampaignsCheck", fileSizeCampaignsCheck)
      }

    } catch (e) {
      consola.error('fileSizeCampaignsCheckError:', e)
    }
  })

  socket.on('disconnect', () => {
    consola.warn(`client disconnected ID:${socket.id}`);
  })
});

io.on('connect', async (socket: Socket) => {
  consola.success(`connect id`, socket.id)
})

if (process.env.ENV !== 'development') {
  setInterval(setCampaignsRecipe, 60000) // 60000 -> 60 sec
  setInterval(setOffersRecipe, 60000) // 60000 -> 60 sec

  // setInterval(setFileSizeOffers, 20000)
  // setInterval(setFileSizeCampaigns, 20000)
}

setInterval(setCampaignsRecipe, 60000) // 60000 -> 60 sec
setInterval(setOffersRecipe, 60000) // 60000 -> 60 sec

setTimeout(setCampaignsRecipe, 20000) // 20000 -> 20 sec
setTimeout(setOffersRecipe, 20000) // 20000 -> 20 sec



httpServer.listen(port, host, (): void => {
  consola.success(`server is running on http://${host}:${port}`)
});