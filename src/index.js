const { ApolloServer, gql } = require("apollo-server");
const dotenv = require("dotenv");
const { MongoClient } = require("mongodb");
const bcrypt = require("bcryptjs");

dotenv.config();

const { DB_URI, DB_NAME } = process.env;

// A schema is a collection of type definitions (hence "typeDefs")
// that together define the "shape" of queries that are executed against
// your data.

const typeDefs = gql`
  type Query {
    myProjects: [Project!]!
  }

  type Mutation {
    signUp(input: SignUpInput): AuthUser!
    signIn(input: SignInInput): AuthUser!
  }

  input SignUpInput {
    name: String!
    email: String!
    password: String!
    avatar: String
  }

  input SignInInput {
    email: String!
    password: String!
  }

  type AuthUser {
    user: User!
    token: String!
  }

  type User {
    _id: ID!
    name: String!
    email: String!
    password: String!
    avatar: String
  }

  type Project {
    _id: ID!
    createdAt: String!
    title: String!
    progress: Float!

    users: [User!]!
    taskLists: [TaskList!]!
  }

  type TaskList {
    _id: ID!
    content: String!
    isCompleted: Boolean!

    projectId: Project
  }
`;

// Resolvers define the technique for fetching the types defined in the
// schema. This resolver retrieves books from the "books" array above.
const resolvers = {
  Query: {
    myProjects: () => [],
  },
  Mutation: {
    signUp: async (_, { input }, { db }) => {
      const hashedPassword = bcrypt.hashSync(input.password);
      let result;

      const user = {
        ...input,
        password: hashedPassword,
      };
      console.log(user);
      // save to database
      try {
        result = await db.collection("Users").insertOne(user);
      } finally {
        //console.log(result.insertedId);
      }

      return {
        user,
        token: "token",
      };
    },

    signIn: async (_, { input }, { db }) => {
      const user = await db.collection("Users").findOne({ email: input.email });
      console.log(user);

      if (!user) {
        throw new Error("Invalid Credentials");
      }

      // check password
      const isPasswordCorrect = bcrypt.compareSync(
        input.password,
        user.password
      );
      if (!isPasswordCorrect) {
        throw new Error("Password not correct");
      }
      return {
        user,
        token: "token",
      };
    },
  },
};

const start = async () => {
  const uri =
    "mongodb+srv://user:user@cluster0.4nddg.mongodb.net/TaskBri?retryWrites=true&w=majority";
  const client = new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  try {
    //client.connect();
    client.connect((err) => {});
    const db = client.db("TaskBri");

    const context = {
      db,
    };

    const server = new ApolloServer({ typeDefs, resolvers, context });

    // The `listen` method launches a web server.
    server.listen().then(({ url }) => {
      console.log(`🚀  Server ready at ${url}`);
    });
  } finally {
    await client.close();
  }
};

start().catch(console.dir);
