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
import {
  getOffers,
  reCalculateOffer,
  reCalculateOfferCaps
} from "./models/offersModel";
import {sqsProcess} from "./sqs";

import {influxdb} from "./metrics";

const app: Application = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {});
const host: string = process.env.HOST || ''
const port: number = Number(process.env.PORT || '3001')

app.get('/health', (req: Request, res: Response) => {
  res.json('Ok')
})

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
// https://co-recipe.jatun.systems/files
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
// https://co-recipe.jatun.systems/fileSizeInfoRedis
app.get('/fileSizeInfoRedis', async (req: Request, res: Response) => {
  try {
    let fileSizeCampaignsRecipe: number = Number(await redis.get(`campaignsSize`)) || 0
    let fileSizeOffersRecipe: number = Number(await redis.get(`offersSize`)) || 0

    res.json({
      fileSizeCampaignsRecipe,
      fileSizeOffersRecipe
    })
  } catch (e) {
    res.json({err: e})
  }

})

app.get('/caps', async (req: Request, res: Response) => {
  try {
    let caps = await reCalculateOfferCaps(35890)
    // let offer = await getOffer(19)
    res.json({
      // offer,
      caps
    })
  } catch (e) {
    res.json({err: e})
  }

})

app.get('/customPayot', async (req: Request, res: Response) => {
  try {
    let offers: object | any = await getOffers()

    let offerFormat: any = []
    for (const offer of offers) {
      let reCalcOffer = await reCalculateOffer(offer)
      offerFormat.push(reCalcOffer)
    }


    res.json({
      offerFormat
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
        consola.warn(`fileSize offer is different, fileSizeOffersCoTraffic:${fileSizeOffersCheck}, fileSizeOffersRecipe:${fileSizeOffersRecipe} `)
        influxdb(200, `file_size_changed_offers`)
        io.to(socket.id).emit("fileSizeOffersCheck", fileSizeOffersRecipe)
      }

    } catch (e) {
      influxdb(500, `file_size_offers_check_error`)
      consola.error('fileSizeOffersCheckError:', e)
    }
  })

  socket.on('fileSizeCampaignsCheck', async (fileSizeCampaignsCheck: number) => {
    try {
      let fileSizeCampaignsRecipe: number = Number(await redis.get(`campaignsSize`))
      if (fileSizeCampaignsCheck !== fileSizeCampaignsRecipe) {
        consola.warn(`fileSize campaigns is different, fileSizeCampaignsCoTraffic:${fileSizeCampaignsCheck}, fileSizeCampaignsRecipe:${fileSizeCampaignsRecipe} `)
        influxdb(200, `file_size_changed_campaigns`)
        io.to(socket.id).emit("fileSizeCampaignsCheck", fileSizeCampaignsRecipe)
      }

    } catch (e) {
      influxdb(500, `file_size_campaigns_check_error`)
      consola.error('fileSizeCampaignsCheckError:', e)
    }
  })
  let updRedis: any = []

  const sendUpdRedis = async () => {
    try {
      let messages = await sqsProcess()

      if (!messages) return
      for (const message of messages) {
        // console.log(`send to socket ${socket.id} messageId:${message.id}, action:${message.action}, type:${message.type}`)
        consola.info(`send to socket ${socket.id}, message:${JSON.stringify(message)}`)
        io.sockets.emit("updRecipe", message)
      }

    } catch (e) {
      influxdb(500, `upd_recipe_error`)
      consola.error('updRecipeError:', e)
    }
  }

  updRedis[socket.id] = setInterval(sendUpdRedis, 30000) // 30 sec

  socket.on('disconnect', () => {
    clearInterval(updRedis[socket.id])
    consola.warn(`client disconnected ID:${socket.id}`);
  })
});

io.on('connect', async (socket: Socket) => {
  consola.success(`connect id`, socket.id)
})

setInterval(setCampaignsRecipe, 300000) // 300000 -> 5 min
setInterval(setOffersRecipe, 300000) // 300000 -> 5 min

setTimeout(setCampaignsRecipe, 20000) // 20000 -> 20 sec
setTimeout(setOffersRecipe, 10000) // 20000 -> 20 sec

httpServer.listen(port, host, (): void => {
  consola.success(`server is running on http://${host}:${port}`)
});