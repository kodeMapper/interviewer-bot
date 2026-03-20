# Swagger User Guide

> Beginner-friendly guide for this project

---

## 1. What is Swagger?

Swagger is a web page that shows your API in a clean format.

It helps you:

- see all endpoints in one place
- understand what each endpoint does
- send test requests without writing code
- see the response directly in the browser

In simple words:

- frontend = what user sees
- backend/API = what does the work
- Swagger = test page for the backend/API

---

## 2. Which Swagger pages are available in this project?

This project now has **3 main API docs pages**:

### A. Proctoring FastAPI Swagger

URL:

```text
http://127.0.0.1:5000/docs
```

Use this for:

- camera status
- start proctoring
- stop proctoring
- session metadata
- settings
- reports
- frame and video endpoints

### B. Docs Hub

URL:

```text
http://127.0.0.1:5000/api-docs
```

Use this when you want one simple starting page.

It gives you links to all Swagger pages in one place.

### C. Express Backend Swagger

URL:

```text
http://localhost:5001/api/docs
```

Use this for:

- interview session APIs
- question APIs
- resume upload APIs
- session history APIs
- proctoring proxy APIs

### D. ML Service Swagger

URL:

```text
http://localhost:8000/docs
```

Use this for:

- answer evaluation
- intent prediction
- model info
- ML health check

---

## 3. Very Important: Swagger is not only for FastAPI

Many beginners think Swagger works only with FastAPI.

That is **not true**.

Swagger works with **any backend** if we provide an OpenAPI/Swagger definition.

So in this project:

- FastAPI docs are auto-generated from Python code
- Express docs are manually described in an OpenAPI file

That is why you can test both:

- FastAPI endpoints
- Express endpoints

---

## 4. Before opening Swagger

You must start the service first.

If the service is not running, Swagger may open, but the request will fail.

### Start the Proctoring API

```powershell
cd proctoring_fastapi
python server.py
```

### Start the Express API

```powershell
cd server
npm run dev
```

### Start the ML Service

```powershell
cd ml-service
uvicorn main:app --reload --port 8000
```

---

## 5. How to use Swagger step by step

### Step 1. Open the Swagger URL

Example:

```text
http://127.0.0.1:5000/docs
```

### Step 2. Find the endpoint you want

You will see a list of API blocks.

Example:

- `GET /status`
- `POST /settings`
- `GET /cameras`

### Step 3. Click the endpoint block

It will expand and show:

- what it does
- inputs
- example body
- response details

### Step 4. Click `Try it out`

This allows you to enter values.

### Step 5. Fill the input

Examples:

- path value like `sessionId`
- query values like `page=1`
- JSON body for `POST`
- file upload for resume endpoint

### Step 6. Click `Execute`

Swagger will send the request.

### Step 7. Read the result

You will see:

- request URL
- response code like `200`, `400`, `404`, `500`
- response body

---

## 6. What the response codes mean

### `200 OK`

Request worked.

### `201 Created`

New data was created.

Example:

- creating an interview session

### `204 No Content`

Request worked, but there is no response body.

Example:

- frame not available yet

### `400 Bad Request`

Your input is wrong.

Example:

- missing field
- invalid topic
- bad JSON format

### `404 Not Found`

The item or file does not exist.

Example:

- wrong session id
- no report yet

### `500 Internal Server Error`

Backend code failed.

This usually means:

- bug in code
- model not loaded
- database problem
- missing dependency

---

## 7. Easy examples you can try first

If you are a beginner, test in this order.

### Proctoring FastAPI

1. `GET /status`
2. `GET /settings`
3. `GET /cameras`
4. `GET /start`
5. `GET /stop`

### Express API

1. `GET /health`
2. `GET /api/questions/topics`
3. `GET /api/questions/stats`
4. `GET /api/session/stats/summary`
5. `POST /api/interview/start`

### ML Service

1. `GET /health`
2. `GET /model-info`
3. `POST /predict-intent`
4. `POST /evaluate`

---

## 8. Example JSON bodies

### Example for Proctoring Settings

```json
{
  "dark_environment": true,
  "face_detection": true,
  "gaze_tracking": true,
  "multiple_people": true
}
```

### Example for Session Metadata

```json
{
  "candidate_name": "Ritesh Kumar",
  "roll_number": "A123",
  "subject": "Deep Learning",
  "exam_id": "DL-TEST-01"
}
```

### Example for Starting an Interview Session

```json
{
  "skills": ["Python", "React", "SQL"],
  "resumePath": null
}
```

### Example for ML Intent Prediction

```json
{
  "text": "I have worked with Python, FastAPI, React and SQL in my projects.",
  "threshold": 0.5
}
```

### Example for ML Answer Evaluation

```json
{
  "user_answer": "React uses a virtual DOM to update the UI efficiently.",
  "expected_answer": "The virtual DOM is a lightweight copy of the real DOM used for efficient updates.",
  "keywords": ["virtual dom", "efficient updates", "react"]
}
```

---

## 9. Special note for file upload endpoints

Some endpoints need a file.

Example:

- `POST /api/resume/upload`

For these endpoints:

1. click `Try it out`
2. choose the file
3. fill the other text fields like `sessionId`
4. click `Execute`

Do **not** paste JSON for file uploads.

That endpoint uses **multipart/form-data**, not normal JSON.

---

## 10. Special note for stream endpoints

Some endpoints return live video or image data.

Examples:

- `GET /video_feed`
- `GET /api/proctoring/video`
- `GET /frame`

These are a little different from normal JSON APIs.

What to know:

- `frame` is easy to test from Swagger
- `video_feed` is better to open in a normal browser tab
- stream endpoints may not look nice inside Swagger response boxes

So if a video stream does not display nicely in Swagger, that does **not always mean it is broken**

---

## 11. Common mistakes beginners make

### Mistake 1. Service is not running

Problem:

- Swagger opens, but execute fails

Fix:

- start the correct backend first

### Mistake 2. Wrong port

Correct ports in this project:

- `5000` = Proctoring FastAPI
- `5001` = Express backend
- `8000` = ML service

### Mistake 3. Wrong request type

Examples:

- sending `GET` instead of `POST`
- using JSON for file upload

### Mistake 4. Invalid JSON

Wrong:

```json
{
  "skills": [Python, React]
}
```

Right:

```json
{
  "skills": ["Python", "React"]
}
```

### Mistake 5. Wrong session id

Some endpoints need a valid `sessionId`.

If you use a random value, you may get:

- `404 Not Found`
- `400 Bad Request`

---

## 12. How to edit the Swagger docs later

This part is important.

Swagger pages do **not** all come from the same place.

### A. To edit Proctoring FastAPI Swagger

Edit:

```text
proctoring_fastapi/server.py
```

This file controls:

- title
- description
- tags/groups
- request bodies
- response models
- docs hub page

If you add a new FastAPI endpoint, also add:

- `summary`
- `tags`
- `response_model` if possible

That makes Swagger cleaner.

### B. To edit Express Swagger

Edit:

```text
server/src/docs/openapi.js
```

This file is the manual Swagger/OpenAPI definition for Express.

If you add a new Express endpoint:

1. create the real route in Express
2. then add the endpoint description in `server/src/docs/openapi.js`

If you only create the route in Express and forget this file:

- the API may work
- but it will not appear in Swagger

### C. To edit the Express Swagger route itself

Edit:

```text
server/src/app.js
```

This file serves:

- `/api/docs`
- `/api/docs/openapi.json`

### D. To edit ML Service Swagger

Edit:

```text
ml-service/main.py
```

This works like normal FastAPI docs.

If you add or change an endpoint there, Swagger updates from the route definitions.

---

## 13. What to do after editing Swagger

After changing Swagger-related code:

### For FastAPI services

Stop and restart the service.

Example:

```powershell
python server.py
```

or

```powershell
uvicorn main:app --reload --port 8000
```

### For Express

Restart the server.

Example:

```powershell
npm run dev
```

Then refresh the browser page.

---

## 14. Simple rule to remember

If the endpoint is in:

- `proctoring_fastapi/server.py` -> edit FastAPI code
- `ml-service/main.py` -> edit FastAPI code
- `server/src/...` -> edit Express code
- `server/src/docs/openapi.js` -> edit Express Swagger docs

---

## 15. Best place to start every time

If you forget all URLs, just open:

```text
http://127.0.0.1:5000/api-docs
```

That page is your starting point.

From there you can open:

- Proctoring Swagger
- Express Swagger
- ML Swagger

---

## 16. Final beginner workflow

Use this simple order:

1. start the backend/service
2. open its Swagger page
3. test a small `GET` endpoint first
4. then test `POST` endpoints
5. then test file upload or stream endpoints
6. if something fails, check:
   service running?
   correct port?
   correct method?
   correct body?

---

## 17. Short summary

- Swagger is a test page for APIs
- it works for both FastAPI and Express
- this project has separate Swagger pages for each service
- use the docs hub if you are not sure where to start
- FastAPI docs are generated from Python routes
- Express docs are written manually in `server/src/docs/openapi.js`

---

If you want, I can also create:

- a **very short 1-page cheat sheet**
- a **screenshots-based guide**
- or a **developer guide** for how to add new endpoints into Swagger
