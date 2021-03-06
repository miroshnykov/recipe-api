import { createServer } from 'node:http';
import { Server, Socket } from 'socket.io';
import 'dotenv/config';
import consola from 'consola';

import express, {
  Application, Request, Response,
} from 'express';
import axios from 'axios';
import md5 from 'md5';
import { setOffersRecipe } from './crons/offersRecipe';
import { redis } from './redis';
import { setCampaignsRecipe } from './crons/campaignsRecipe';
import {
  encrypt, getLocalFiles, getFileSize,
} from './utils';
import { sqsProcess } from './sqs';

import { influxdb, sendMetricsSystem } from './metrics';
import { ISqsMessage } from './interfaces/sqsMessage';
import { AppModel } from './interfaces/recipeTypes';
import { syncAffiliates } from './crons/syncToRedshift/affiliates';
import { syncOffers } from './crons/syncToRedshift/offers';
import { syncCampaigns } from './crons/syncToRedshift/campaigns';

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
    if (!req.query.hash || req.query.hash !== process.env.ENCRIPTION_KEY) {
      throw Error('broken key');
    }
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
  } catch (e: any) {
    consola.error(e);
    res.json({
      success: false,
      info: e.toString(),
    });
  }
});

// http://localhost:3001/bonusLid
app.get('/bonusLid', async (req: Request, res: Response) => {
  try {
    const timestamp = Date.now();
    const secret = process.env.GATEWAY_API_SECRET;
    const hash = md5(`${timestamp}|${secret}`);

    const params = {
      lid: 'f19ef205-f19f-4a94-9947-adf4620b12d9',
      hash,
      timestamp,
    };
    // const { data } = await axios.post('https://traffic.aezai.com/lid', params);
    const { data } = await axios.post('http://localhost:5000/lid', params);
    res.json(data);
  } catch (e) {
    consola.error(e);
    res.json({ err: e });
  }
});

// // http://localhost:3001/decodeUrl?code=
// app.get('/decodeUrl', async (req: Request, res: Response) => {
//   interface DecodedObj {
//     offerId: number
//     campaignId: number
//   }
//
//   try {
//     const code: string = String(req.query.code);
//     const decodedString: string = decrypt(code);
//     const formatCode: DecodedObj = JSON.parse(decodedString!);
//
//     res.json(formatCode);
//   } catch (e) {
//     consola.error(e);
//     res.json({ err: e });
//   }
// });

// http://localhost:3001/files
// https://co-recipe.jatun.systems/files
app.get('/files', async (req: Request, res: Response) => {
  try {
    if (!req.query.hash || req.query.hash !== process.env.ENCRIPTION_KEY) {
      throw Error('broken key');
    }

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

// http://localhost:3001/fileSizeInfoRedis?hash=
// https://co-recipe.jatun.systems/fileSizeInfoRedis
// https://recipe.aezai.com/fileSizeInfoRedis
app.get('/fileSizeInfoRedis', async (req: Request, res: Response) => {
  try {
    if (!req.query.hash || req.query.hash !== process.env.ENCRIPTION_KEY) {
      throw Error('broken key');
    }
    const fileSizeCampaignsRecipe: number = Number(await redis.get('campaignsSizeRecipe')) || 0;
    const fileSizeOffersRecipe: number = Number(await redis.get('offersSizeRecipe')) || 0;

    res.json({
      fileSizeCampaignsRecipe,
      fileSizeOffersRecipe,
    });
  } catch (e: any) {
    res.json({
      success: false,
      info: e.toString(),
    });
  }
});

// app.get('/caps', async (req: Request, res: Response) => {
//   try {
//     // let offers:IOffer[] = await getOffers()||[]
//     const caps = await reCalculateOfferCaps(36818);
//     // let caps = await reCalculateOfferCaps(35899)
//     // let offer = await getOffer(19)
//     res.json({
//       caps,
//     });
//   } catch (e) {
//     res.json({ err: e });
//   }
// });

// app.get('/capsCampaigns', async (req: Request, res: Response) => {
//   try {
//     const campaigns: ICampaign[] | undefined = await getCampaigns();
//     if (!campaigns) {
//       consola.error('recipe_campaigns_created_error');
//       return;
//     }
//
//     const campaignsFormat: any = [];
//     await Promise.all(campaigns.map(async (campaign) => {
//       if (campaign.capsEnabled) {
//         const reCalcCampaign = await reCalculateCampaignCaps(campaign.campaignId);
//         campaignsFormat.push(reCalcCampaign);
//       } else {
//         campaignsFormat.push(campaign);
//       }
//     }));
//
//     res.json({
//       campaignsFormat,
//     });
//   } catch (e) {
//     res.json({ err: e });
//   }
// });

// https://recipe.aezai.com/link
// app.get('/link', async (req: Request, res: Response) => {
//   try {
//     setTimeout(testLinksOffers, 10000); // 10000 -> 10s
//     setTimeout(testLinksCampaigns, 20000); // 20000 -> 20s
//     res.json('added to queue testLinksOffers  testLinksCampaigns');
//   } catch (e) {
//     res.json({ err: e });
//   }
// });

// app.get('/reCalculateOffer', async (req: Request, res: Response) => {
//   try {
//     // reqular 36816
//     // aggregated  36817
//     // caps  36815
//     const offerId = 36817;
//     const offer: IOffer = await getOffer(offerId);
//     const reCalcOfferRes = await reCalculateOffer(offer);
//
//     res.json({
//       reCalcOfferRes,
//     });
//   } catch (e) {
//     res.json({ err: e });
//   }
// });

// http://localhost:3001/syncAffiliates?hash=
// https://recipe.aezai.com/syncAffiliates
// https://recipe.stage.aezai.com/syncAffiliates?hash=
app.get('/syncAffiliates', async (req: Request, res: Response) => {
  try {
    if (!req.query.hash || req.query.hash !== process.env.ENCRIPTION_KEY) {
      throw Error('broken key');
    }
    setTimeout(syncAffiliates, 2000);

    res.json({
      response: 'setAffiliatesRecipe to sqs',
    });
  } catch (e: any) {
    res.json({
      success: false,
      info: e.toString(),
    });
  }
});

// http://localhost:3001/syncOffers?hash=
// https://recipe.aezai.com/syncOffers
// https://recipe.stage.aezai.com/syncOffers?hash=
app.get('/syncOffers', async (req: Request, res: Response) => {
  try {
    if (!req.query.hash || req.query.hash !== process.env.ENCRIPTION_KEY) {
      throw Error('broken key');
    }
    setTimeout(syncOffers, 2000);

    res.json({
      response: 'syncOffers to sqs',
    });
  } catch (e: any) {
    res.json({
      success: false,
      info: e.toString(),
    });
  }
});

// http://localhost:3001/syncCampaigns?hash=
// https://recipe.aezai.com/syncCampaigns
// https://recipe.stage.aezai.com/syncCampaigns?hash=
app.get('/syncCampaigns', async (req: Request, res: Response) => {
  try {
    if (!req.query.hash || req.query.hash !== process.env.ENCRIPTION_KEY) {
      throw Error('broken key');
    }
    setTimeout(syncCampaigns, 2000);

    res.json({
      response: 'syncCampaigns to sqs',
    });
  } catch (e: any) {
    res.json({
      success: false,
      info: e.toString(),
    });
  }
});

io.on('connection', (socket: Socket) => {
  consola.success('connection');
  socket.on('fileSizeOffersCheck', async (fileSizeOffersCheck: number) => {
    try {
      // consola.info(`Get size from engine:${fileSizeOffersCheck}`)
      const fileSizeOffersRecipe: number = Number(await redis.get('offersSizeRecipe'));

      if (!fileSizeOffersRecipe) {
        influxdb(500, 'file_size_redis_empty_offers');
        consola.info(`[OFFERS] FileSizeOffersRecipe:${fileSizeOffersRecipe} not set up yet, dont need to send to co-traffic empty size for DB name - { ${process.env.DB_NAME} } `);
        return;
      }
      if (fileSizeOffersCheck !== fileSizeOffersRecipe) {
        consola.warn(`[OFFERS] fileSize offer is different, fileSizeOffersCoTraffic:${fileSizeOffersCheck}, fileSizeOffersRecipe:${fileSizeOffersRecipe}  for DB name - { ${process.env.DB_NAME} }  `);
        influxdb(200, 'file_size_changed_offers');
        io.to(socket.id).emit('fileSizeOffersCheck', fileSizeOffersRecipe);
      }
    } catch (e) {
      influxdb(500, 'file_size_offers_check_error');
      consola.error('[OFFERS] fileSizeOffersCheckError:', e);
    }
  });

  socket.on('fileSizeCampaignsCheck', async (fileSizeCampaignsCheck: number) => {
    try {
      const fileSizeCampaignsRecipe: number = Number(await redis.get('campaignsSizeRecipe'));
      if (!fileSizeCampaignsRecipe) {
        influxdb(500, 'file_size_redis_empty_campaign');
        consola.info(`[CAMPAIGNS] FileSizeCampaignsRecipe:${fileSizeCampaignsRecipe} not set up yet, dont need to send to co-traffic empty size  for DB name - { ${process.env.DB_NAME} } `);
        return;
      }

      if (fileSizeCampaignsCheck !== fileSizeCampaignsRecipe) {
        consola.warn(`[CAMPAIGNS] fileSize campaigns is different, fileSizeCampaignsCoTraffic:${fileSizeCampaignsCheck}, fileSizeCampaignsRecipe:${fileSizeCampaignsRecipe}  for DB name - { ${process.env.DB_NAME} } `);
        influxdb(200, 'file_size_changed_campaigns');
        io.to(socket.id).emit('fileSizeCampaignsCheck', fileSizeCampaignsRecipe);
      }
    } catch (e) {
      influxdb(500, 'file_size_campaigns_check_error');
      consola.error('[CAMPAIGNS] fileSizeCampaignsCheckError:', e);
    }
  });
  const updRedis: any = [];

  const sendUpdRecipe = async (): Promise<void> => {
    try {
      const messages: ISqsMessage[] = await sqsProcess();
      if (messages.length === 0) return;
      // consola.log(`Got { ${messages.length} } messages from sqs from sfl_worker or admin-api`);
      for (const message of messages) {
        // consola.info(`send to socket ${socket.id}, message:${JSON.stringify(message)}`)
        // consola.info(`send to socket ${socket.id}, ${message.type}ID:${message.id}, action:${message.action}, project:${message.project}, comments:${message.comments}, APP_MODEL:${process.env.APP_MODEL}`);
        io.sockets.emit('updRecipe', message);
      }
    } catch (e) {
      influxdb(500, 'upd_recipe_error');
      consola.error('updRecipeError:', e);
    }
  };
  if (process.env.APP_MODEL === AppModel.MASTER) {
    updRedis[socket.id] = setInterval(sendUpdRecipe, 30000); // 30 sec
  }

  socket.on('disconnect', () => {
    clearInterval(updRedis[socket.id]);
    consola.warn(`client disconnected ID:${socket.id}`);
    influxdb(500, `disconnect_traffic_api_${process.env.APP_MODEL}`);
  });
});

io.on('connect', async (socket: Socket) => {
  influxdb(200, `connect_traffic_api_${process.env.APP_MODEL}`);
  consola.success('connect id', socket.id);
});

// for campaigns master time = (300000 -> 5 min)  for slave time = (360000 -> 6 min)
const intervalTimeCampaign = process.env.APP_MODEL === AppModel.MASTER ? 300000 : 360000;
setInterval(setCampaignsRecipe, intervalTimeCampaign);

// for offers master time = (420000 -> 7 min)  for slave time = (480000 -> 8 min)
const intervalTimeOffer = process.env.APP_MODEL === AppModel.MASTER ? 420000 : 480000;
setInterval(setOffersRecipe, intervalTimeOffer);

if (process.env.APP_MODEL === AppModel.MASTER) {
  // PH-1156 sync table from mysql 'sfl_affiliates' to redshift table 'affiliates'
  setInterval(syncAffiliates, 540000); //  540000 -> 9 min
  setTimeout(syncAffiliates, 40000); // 40000 -> 40 sec

  // PH-1179 sync table from mysql 'sfl_offers' to redshift table 'offers'
  setInterval(syncOffers, 600000); //  600000 -> 10 min
  setTimeout(syncOffers, 60000); // 60000 -> 60 sec

  // PH-1179 sync table from mysql 'sfl_offer_campaigns' to redshift table 'campaigns'
  setInterval(syncCampaigns, 660000); //  660000 -> 11 min
  setTimeout(syncCampaigns, 70000); // 70000 -> 70 sec
}

setTimeout(setCampaignsRecipe, 30000); // 30000 -> 30 sec
setTimeout(setOffersRecipe, 10000); // 10000 -> 10 sec

setInterval(() => {
  if (process.env.NODE_ENV === 'development') return;
  sendMetricsSystem();
}, 30000);

// consola.warn('process.env:', process.env);
// setInterval(testLinksOffers, 28800000) // 28800000 -> 8h
// setInterval(testLinksCampaigns, 25200000) // 25200000 -> 7h

httpServer.listen(port, host, (): void => {
  consola.success(`server is running on http://${host}:${port} Using node - { ${process.version} } DB name - { ${process.env.DB_NAME} } DB port - { ${process.env.DB_PORT} }`);
});

process
  .on('unhandledRejection', (reason, p) => {
    consola.error(reason, 'Unhandled Rejection at Promise', p);
    influxdb(500, 'unhandledRejection');
  })
  .on('uncaughtException', (err: Error) => {
    consola.error(err, 'Uncaught Exception thrown');
    influxdb(500, 'uncaughtException');
    process.exit(1);
  });
