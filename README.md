> Recipe server generator 
## Generate recipe
    Every minutes we generated zip files with offers & campaigns
    send those files to s3 folder co-recipe-prod
    set to local redis size of files

## Sockets
    for sync size of recipes (offers&campaigns)
    co-traffic send size of recipes every 20 second, co-recipe check origin size with co-traffic.
    If size is differen co-recipe send the notification to co-traffic.
    Co-traffic get new recipe from s3

## Update particular record inside the recipe
    if the record offer or campaign was added | updated | deleted, project co-admin-back send sqs message with offerId or campaignId to co-recipe.
    Co-recipe handle this record and send by socket to co-traffic with new data

## Docker setup
	docker build -t co-recipe .
   	docker run -it -p 3001:3001 --rm --name co-recipe-  co-recipe

## run
    create folder /tmp/co-recipe on local env
    npm run dev

## build
    npm run build

## env example
    HOST=localhost
    PORT=3001
    ENV=development
    DB_HOST=127.0.0.1
    DB_PORT=3007
    DB_USERNAME=
    DB_PASSWORD=
    DB_NAME=traffic

    AWS_ACCESS_KEY_ID=
    AWS_SECRET_ACCESS_KEY=
    AWS_REGION=us-east-1

    OFFERS_RECIPE_PATH=/tmp/co-recipe/offersRecipe.json
    CAMPAIGNS_RECIPE_PATH=/tmp/co-recipe/campaignsRecipe.json

    S3_CAMPAIGNS_RECIPE_PATH=campaignsRecipe.json.gz
    S3_OFFERS_RECIPE_PATH=offersRecipe.json.gz
    S3_BUCKET_NAME=co-recipe-staging

    AWS_SQS_QUEUE_URL=

    ENCRIPTION_KEY=
    ENCRIPTION_IV_LENGTH=

## docker build
   docker build -t co-recipe .
   docker run -it -p 3001:3001 --rm --name co-recipe-  co-recipe

