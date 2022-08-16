# Incredible Dev



## What's inside?

This is a turborepo which uses [Yarn](https://classic.yarnpkg.com/lang/en/) as a package manager. It includes the following packages/apps:

### Apps and Packages

- `webfront`: App with landing and consumption pages
- `ui`: a stub React component library shared by frontend applications
- `config`: `eslint`, `typescript`, `tailwind` configurations

## Installing new turbo-repo dependencies

```sh
yarn workspace {app/package} add {dependency}
```

## Other dependencies

### Dependent Services

1. **Color-codes**

    A service that provides color codes for each token w.r.t to the programming language's grammar.

#### Setup

  i. Clone this `repo` and `cd` into it.

  ii. build the docker image

  ```sh
  docker build -t colorcodes .
  ```

  iii. set the environment variable `NEXT_PUBLIC_TOKENIZE_ENDPOINT` to the docker image's url.

2.**MySQL** Database

Once you have finished building the docker image for `colorcodes` you can start the service.

```sh
docker-compose up -d
```


## Dependent 3rd Party Providers

### **Firebase**

i) Go to <https://console.firebase.google.com/>

ii) Create a new project

iii) On the left hand side menu , click on `Build > Authentication> Get Started`

iv) Go to `settings > project settings > General` , under your apps create a new `web-app` . After giving an app name you will be able to see the firebase config for that app. Copy and paste the `firebaseConfig` as json into the environment variable `NEXT_PUBLIC_FIREBASE_CONFIG` in `.env` file of webfront.

v) Goto `settings > project settings > service accounts > Generate new private key` and copy the json into the environment variable `FIREBASE_SERVICE_CONFIG` in `.env` file of `packages/server`.

*Note: When using json in env make sure the quotes are escaped.*

### Liveblocks

> This is a proprietary 3rd party service that is used by the frontend.You will be required to signup and provide a api-key to be able to run this branch.

### Hocuspocus

> This is a proprietary 3rd party service that is used by the frontend.You will be required to signup and provide a api-key to be able to run this branch.

### Cloud AWS

> This is a proprietary 3rd party service that is used by the frontend.You will be required to signup and provide a api-key to be able to run this branch.Below is the list of aws services used in this project:

- Media Convert
  > This is a service that combine media files of different blocks.
- S3 ( check)
  > This is a service that provides object storage for media files , assets , generated content etc.

## Installation

Run the following command to install all the dependencies:

```sh
yarn
```

### Prisma

Initially to apply the schema to the new db we need to run the following command:

```sh
cd packages/prisma-orm
export DATABASE_URL="YOUR_DB_URL"
npx prisma db push
yarn seed
```

and on every schema change run:

```sh
npx prisma db push
```

## Run locally

```sh
yarn dev
```
