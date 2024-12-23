const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;
app.use(
  cors({
    origin: ["http://localhost:5173", "https://job-portal-sajmul.web.app"],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

const verifyToken = (req, res, next) => {
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).send({ message: "Unauthorized access" });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "Unauthorized access" });
    }
    req.user = decoded;
    next();
  });
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.saftd.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const jobCollection = client.db("jobPortal").collection("jobs");
    const jobApplicationCollection = client
      .db("jobPortal")
      .collection("applications");

    // auth related api
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: "1h" });
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });

    app.post("/logout", (req, res) => {
      res.clearCookie("token", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
      });
      send({ success: true });
    });

    app.get("/jobs", async (req, res) => {
      const email = req.query.email;
      let query = {};
      if (email) {
        query = { hr_email: email };
      }
      const result = await jobCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/jobs", async (req, res) => {
      const data = req.body;
      const result = await jobCollection.insertOne(data);
      res.send(result);
    });

    app.get("/jobs/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await jobCollection.findOne(query);
      res.send(result);
    });

    // application apis

    app.post("/job-applications", async (req, res) => {
      const application = req.body;
      const result = await jobApplicationCollection.insertOne(application);

      const id = application.jobId;
      const query = { _id: new ObjectId(id) };
      const job = await jobCollection.findOne(query);
      let newCount = 0;

      if (job.applicationCount) {
        newCount = newCount + 1;
      } else {
        newCount = 1;
      }

      const updatedDoc = {
        $set: {
          applicationCount: newCount,
        },
      };

      const updatedResult = await jobCollection.updateOne(query, updatedDoc);
      res.send(result);
    });

    app.get("/job-application", verifyToken, async (req, res) => {
      const email = req.query.email;
      const query = { applicant_email: email };

      if (req.user.email !== email) {
        return res.status(403).send({ massage: "forbidden access" });
      }

      const result = await jobApplicationCollection.find(query).toArray();

      for (const application of result) {
        const query = { _id: new ObjectId(application.jobId) };
        const job = await jobCollection.findOne(query);

        if (job) {
          application.title = job.title;
          application.company_logo = job.company_logo;
          application.company = job.company;
          application.location = job.location;
          application.jobType = job.jobType;
          application.category = job.category;
        }
      }

      res.send(result);
    });

    app.get("/job-application/jobs/:job_id", async (req, res) => {
      const jobId = req.params.job_id;
      const query = { jobId: jobId };
      const result = await jobApplicationCollection.find(query).toArray();
      res.send(result);
    });

    app.delete("/job-applications/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await jobApplicationCollection.deleteOne(query);
      res.send(result);
    });

    app.patch("/job-application/:id", async (req, res) => {
      const id = req.params.id;
      const data = req.body;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          status: data.status,
        },
      };

      const result = await jobApplicationCollection.updateOne(
        filter,
        updatedDoc
      );
      res.send(result);
    });

    await client.connect();

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Job server is running");
});

app.listen(port, () => {
  console.log(`Server is running http://localhost:${port}`);
});
