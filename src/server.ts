import { createServer } from 'node:http';
import { Server, Socket } from 'socket.io';
import 'dotenv/config';
import consola from 'consola';

import express, {
  Application, Request, Response,
} from 'express';
import { setOffersRecipe } from './crons/offersRecipe';
import { redis } from './redis';
import { setCampaignsRecipe } from './crons/campaignsRecipe';
import {
  encrypt, decrypt, getLocalFiles, getFileSize,
} from './utils';
import { sqsProcess } from './sqs';

import { influxdb } from './metrics';
import { ICampaign } from './interfaces/campaigns';
import { getCampaigns } from './models/campaignsModel';
import { reCalculateCampaignCaps } from './services/campaignsCaps';
import { reCalculateOffer, reCalculateOfferCaps } from './services/offersReCalculations';
import { ISqsMessage } from './interfaces/sqsMessage';
import { testLinksCampaigns, testLinksOffers } from './tests/links';
import { IOffer } from './interfaces/offers';
import { getOffer } from './models/offersModel';

const app: Application = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {});
const host: string = process.env.HOST || '';
const port: number = Number(process.env.PORT || '3001');

app.get('/api/v1/health', (req: Request, res: Response) => {
  res.json('Ok');
});

// http://localhost:3001/encodeUrl?offerId=1111&campaignId=22222
app.get('/encodeUrl', async (req: Request, res: Response) => {
  try {
    const campaignId: number = Number(req.query.campaignId);
    const offerId = Number(req.query.offerId);

    const obj = {
      offerId,
      campaignId,
    };
    const encodesUrl: string = JSON.stringify(obj);

    const encryptData: string = encrypt(encodesUrl);
    // consola.info('encryptData:', encryptData)
    const response = {
      encryptData,
    };
    res.json(response);
  } catch (e) {
    consola.error(e);
    res.json({ err: e });
  }
});

// http://localhost:3001/decodeUrl?code=
app.get('/decodeUrl', async (req: Request, res: Response) => {
  interface DecodedObj {
    offerId: number
    campaignId: number
  }

  try {
    const code: string = String(req.query.code);
    const decodedString: string = decrypt(code);
    const formatCode: DecodedObj = JSON.parse(decodedString!);

    res.json(formatCode);
  } catch (e) {
    consola.error(e);
    res.json({ err: e });
  }
});

// http://localhost:3001/files
// https://co-recipe.jatun.systems/files
app.get('/files', async (req: Request, res: Response) => {
  try {
    const files = await getLocalFiles('/tmp/co-recipe');
    const filesFormat: any = [];
    await Promise.all(files.map(async (file) => {
      const filePath: string = `/tmp/co-recipe/${file}`;
      const size = await getFileSize(filePath);
      filesFormat.push({ file: filePath, size });
    }));

    res.json(filesFormat);
  } catch (e) {
    res.json({ err: e });
  }
});

// http://localhost:3001/fileSizeInfoRedis
// https://co-recipe.jatun.systems/fileSizeInfoRedis
// https://recipe.aezai.com/fileSizeInfoRedis
app.get('/fileSizeInfoRedis', async (req: Request, res: Response) => {
  try {
    const fileSizeCampaignsRecipe: number = Number(await redis.get('campaignsSizeRecipe')) || 0;
    const fileSizeOffersRecipe: number = Number(await redis.get('offersSizeRecipe')) || 0;

    res.json({
      fileSizeCampaignsRecipe,
      fileSizeOffersRecipe,
    });
  } catch (e) {
    res.json({ err: e });
  }
});

app.get('/caps', async (req: Request, res: Response) => {
  try {
    // let offers:IOffer[] = await getOffers()||[]
    const caps = await reCalculateOfferCaps(36818);
    // let caps = await reCalculateOfferCaps(35899)
    // let offer = await getOffer(19)
    res.json({
      caps,
    });
  } catch (e) {
    res.json({ err: e });
  }
});

app.get('/capsCampaigns', async (req: Request, res: Response) => {
  try {
    const campaigns: ICampaign[] | undefined = await getCampaigns();
    if (!campaigns) {
      consola.error('recipe_campaigns_created_error');
      return;
    }

    const campaignsFormat: any = [];
    await Promise.all(campaigns.map(async (campaign) => {
      if (campaign.capsEnabled) {
        const reCalcCampaign = await reCalculateCampaignCaps(campaign.campaignId);
        campaignsFormat.push(reCalcCampaign);
      } else {
        campaignsFormat.push(campaign);
      }
    }));

    res.json({
      campaignsFormat,
    });
  } catch (e) {
    res.json({ err: e });
  }
});

// https://recipe.aezai.com/link
app.get('/link', async (req: Request, res: Response) => {
  try {
    setTimeout(testLinksOffers, 10000); // 10000 -> 10s
    setTimeout(testLinksCampaigns, 20000); // 20000 -> 20s
    res.json('added to queue testLinksOffers  testLinksCampaigns');
  } catch (e) {
    res.json({ err: e });
  }
});

app.get('/reCalculateOffer', async (req: Request, res: Response) => {
  try {
    // reqular 36816
    // aggregated  36817
    // caps  36815
    const offerId = 36817;
    const offer: IOffer = await getOffer(offerId);
    const reCalcOfferRes = await reCalculateOffer(offer);

    res.json({
      reCalcOfferRes,
    });
  } catch (e) {
    res.json({ err: e });
  }
});

io.on('connection', (socket: Socket) => {
  consola.success('connection');
  socket.on('fileSizeOffersCheck', async (fileSizeOffersCheck: number) => {
    try {
      // consola.info(`Get size from engine:${fileSizeOffersCheck}`)
      const fileSizeOffersRecipe: number = Number(await redis.get('offersSizeRecipe'));

      if (!fileSizeOffersRecipe) {
        consola.info(`fileSizeOffersRecipe:${fileSizeOffersRecipe} not set up yet, dont need to send to co-traffic empty size`);
        return;
      }
      if (fileSizeOffersCheck !== fileSizeOffersRecipe) {
        consola.warn(`fileSize offer is different, fileSizeOffersCoTraffic:${fileSizeOffersCheck}, fileSizeOffersRecipe:${fileSizeOffersRecipe} `);
        influxdb(200, 'file_size_changed_offers');
        io.to(socket.id).emit('fileSizeOffersCheck', fileSizeOffersRecipe);
      }
    } catch (e) {
      influxdb(500, 'file_size_offers_check_error');
      consola.error('fileSizeOffersCheckError:', e);
    }
  });

  socket.on('fileSizeCampaignsCheck', async (fileSizeCampaignsCheck: number) => {
    try {
      const fileSizeCampaignsRecipe: number = Number(await redis.get('campaignsSizeRecipe'));
      if (!fileSizeCampaignsRecipe) {
        consola.info(`fileSizeCampaignsRecipe:${fileSizeCampaignsRecipe} not set up yet, dont need to send to co-traffic empty size `);
        return;
      }

      if (fileSizeCampaignsCheck !== fileSizeCampaignsRecipe) {
        consola.warn(`fileSize campaigns is different, fileSizeCampaignsCoTraffic:${fileSizeCampaignsCheck}, fileSizeCampaignsRecipe:${fileSizeCampaignsRecipe} `);
        influxdb(200, 'file_size_changed_campaigns');
        io.to(socket.id).emit('fileSizeCampaignsCheck', fileSizeCampaignsRecipe);
      }
    } catch (e) {
      influxdb(500, 'file_size_campaigns_check_error');
      consola.error('fileSizeCampaignsCheckError:', e);
    }
  });
  const updRedis: any = [];

  const sendUpdRecipe = async (): Promise<void> => {
    try {
      const messages: ISqsMessage[] = await sqsProcess();

      if (messages.length === 0) return;
      for (const message of messages) {
        // consola.info(`send to socket ${socket.id}, message:${JSON.stringify(message)}`)
        consola.info(`send to socket ${socket.id}, ${message.type}ID:${message.id}, action:${message.action}, project:${message.project}, comments:${message.comments} `);
        io.sockets.emit('updRecipe', message);
      }
    } catch (e) {
      influxdb(500, 'upd_recipe_error');
      consola.error('updRecipeError:', e);
    }
  };

  updRedis[socket.id] = setInterval(sendUpdRecipe, 30000); // 30 sec

  socket.on('disconnect', () => {
    clearInterval(updRedis[socket.id]);
    consola.warn(`client disconnected ID:${socket.id}`);
  });
});

io.on('connect', async (socket: Socket) => {
  consola.success('connect id', socket.id);
});

setInterval(setCampaignsRecipe, 300000); // 300000 -> 5 min
setInterval(setOffersRecipe, 312000); // 312000 -> 5.2 min

setTimeout(setCampaignsRecipe, 20000); // 20000 -> 6 sec
setTimeout(setOffersRecipe, 10000); // 10000 -> 10 sec

// setInterval(testLinksOffers, 28800000) // 28800000 -> 8h
// setInterval(testLinksCampaigns, 25200000) // 25200000 -> 7h

httpServer.listen(port, host, (): void => {
  consola.success(`server is running on http://${host}:${port} Using node - { ${process.version} } DB name - { ${process.env.DB_NAME} } DB port - { ${process.env.DB_PORT} }`);
});
