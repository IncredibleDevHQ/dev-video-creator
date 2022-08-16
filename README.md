# Incredible Dev

## Introduction

!!! WIP, ref oss branch !!!

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

2. **MySQL**

    Once you have finished building the docker image for `colorcodes` you can start the service.

    ```sh
    docker-compose up -d
    ```

3. **Redis**

    This will be used by the `hocuspocus` service to provide realtime collaboration and autosave features.

4. **minio**
    This is an open-source alternative to AWS S3. It is used to store the files uploaded by the user.

---

> **Below is a list of proprietary 3rd party service's that is used in this project.You will be required to signup and provide a api-key to be able to run this branch.**

## Dependent 3rd Party Providers

### **Firebase**

1. Go to <https://console.firebase.google.com/>

2. Create a new project

3. On the left hand side menu , click on `Build > Authentication> Get Started`

4. Go to `settings > project settings > General` , under your apps create a new `web-app` . After giving an app name you will be able to see the firebase config for that app. Copy and paste the `firebaseConfig` as json into the environment variable `NEXT_PUBLIC_FIREBASE_CONFIG` in `.env` file of webfront.

5. Goto `settings > project settings > service accounts > Generate new private key` and copy the json into the environment variable `FIREBASE_SERVICE_CONFIG` in `.env` file of `packages/server`.

*Note: When using json in env make sure the quotes are escaped.*



### **Liveblocks**

You can sign-up for a free account at <https://liveblocks.io/> and get your API key (*NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY*) .


### **Tiptap and Hocuspocus**

[Tiptap](https://tiptap.dev/) is a open-source text editor which is used by the frontend.

> *Note: Currently one of the tiptap-extentions used in this project is only available with [tiptap-pro](https://tiptap.dev/api/extensions/unique-id)*

[Hocuspocus](https://tiptap.dev/hocuspocus) is a service that provides collaborative and realtime features for the Tipatap editor. This enables features such as collaborative editing , realtime cursor movements and autosave feature. This service is dependent on `redis` and `mysql`, which persistently store the notebook.

> *Note: Hocuspocus is still an early access product, you will need to create an account to view the hocuspocus docs.*


### **Cloud (AWS)**

- Media Convert

  This is a service that combine's media files of different blocks.

  > *We are actively working on a open-source alternative to this service using ffmpeg.*

- S3:

  This is a service that provides object storage for media files , assets , generated content etc.

  Minio has been included in the `docker-compose` for local development. You can access the minio console at <http://localhost:9000> with the credentials `incredible:SuperSecretRootPwd`

### **Giphy**

  You can request an api-key  [here](https://support.giphy.com/hc/en-us/articles/360020283431-Request-A-GIPHY-API-Key) and set it as the environment variable `NEXT_PUBLIC_GIPHY_API_KEY` in `.env` file of webfront.

### **Unsplash**

 An api-key can be requested [here](https://unsplash.com/join) and set it a secret in `packages/server/sample.secret.json` to the key `UNSPLASH_ACCESS_KEY` .

### **Agora**

An Agora project can be setup by following [these](https://docs.agora.io/en/Agora%20Platform/get_appid_token?platform=All%20Platforms#get-the-app-id) steps to setup a project and obtain an `APP_ID` and `APP_CERTIFICATE` . These can be set as secrets in `packages/server/sample.secret.json` to the key's `AGORA_APP_ID` and `AGORA_APP_CERTIFICATE` respectively.

### **Google Fonts**

  An api key for google fonts can be acquired from [here](https://developers.google.com/fonts/docs/developer_api#APIKey). This can be set as the environment variable `NEXT_PUBLIC_GOOGLE_FONTS_API_KEY` in `.env` file of webfront.

---

## Adding Environment Variables

Add a new `.env` file with the corresponding values obtained from the respective service's listed above. Refer the `sample.env` files in the appropriate directories.

---
## Database and Prisma

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


---
## Installation

Run the following command to install all the dependencies:

```sh
yarn
```

---


## Run locally

```sh
yarn dev
```
