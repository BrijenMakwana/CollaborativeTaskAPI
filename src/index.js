const { ApolloServer, gql } = require("apollo-server");
const dotenv = require("dotenv");
const { MongoClient, ObjectId } = require("mongodb");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

dotenv.config();

const { DB_URI, DB_NAME, JWT_SECRET } = process.env;

const getToken = (user) =>
  jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: "7 days" });

const getUserFromToken = async (token, db) => {
  if (!token) {
    return null;
  }

  const tokenData = jwt.verify(token, JWT_SECRET);

  if (!tokenData?.id) {
    return null;
  }
  return await db.collection("Users").findOne({ _id: ObjectId(tokenData.id) });
};

// A schema is a collection of type definitions (hence "typeDefs")
// that together define the "shape" of queries that are executed against
// your data.

const typeDefs = gql`
  type Query {
    myProjects: [Project!]!
    getProject(_id: String!): Project

    getUser(_id: String!): User!
    getLoggedInUserDetails: User!
  }

  type Mutation {
    signUp(input: SignUpInput!): AuthUser!
    signIn(input: SignInInput!): AuthUser!

    changePassword(newPassword: String!): Boolean!
    forgetUserPassword(
      userEmail: String!
      oldPassword: String!
      newPassword: String!
    ): Boolean!

    updateAvatar(newAvatar: String!): Boolean!

    createProject(title: String!): Project!
    updateProject(_id: String!, title: String!): Project!
    deleteProject(_id: String!): Boolean!
    deleteAllProjects: Boolean!

    addUserToProject(projectId: String!, userEmail: String!): Project!
    deleteUserFromProject(projectId: String!, userId: String!): Boolean!

    createTaskList(content: String!, projectId: String!): TaskList!
    updateTaskList(
      _id: String!
      content: String
      isCompleted: Boolean
    ): TaskList!
    deleteTaskList(_id: String!): Boolean!
    deleteAllTasks(projectId: String!): Boolean!
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

    project: Project!
  }
`;

// Resolvers define the technique for fetching the types defined in the
// schema. This resolver retrieves books from the "books" array above.
const resolvers = {
  Query: {
    myProjects: async (_, __, { db, user }) => {
      if (!user) {
        throw new Error("Authentication error, please sign in");
      }

      return await db
        .collection("Projects")
        .find({ userIds: user._id })
        .toArray();
    },

    getProject: async (_, { _id }, { db, user }) => {
      if (!user) {
        throw new Error("Authentication error, please sign in");
      }

      return await db.collection("Projects").findOne({ _id: ObjectId(_id) });
    },

    getUser: async (_, { _id }, { db, user }) => {
      if (!user) {
        throw new Error("Authentication error, please sign in");
      }

      return await db.collection("Users").findOne({ _id: ObjectId(_id) });
    },

    getLoggedInUserDetails: async (_, __, { db, user }) => {
      if (!user) {
        throw new Error("Authentication error, please sign in");
      }

      return await db.collection("Users").findOne({ _id: user._id });
    },
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
        console.log(result.insertedId);
      }

      return {
        user,
        token: getToken(user),
      };
    },

    signIn: async (_, { input }, { db }) => {
      const user = await db.collection("Users").findOne({ email: input.email });
      //console.log(user);

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
        token: getToken(user),
      };
    },

    changePassword: async (_, { newPassword }, { db, user }) => {
      if (!user) {
        throw new Error("Authentication error, please sign in");
      }
      const hashedPassword = bcrypt.hashSync(newPassword);
      await db.collection("Users").updateOne(
        { _id: user._id },
        {
          $set: {
            password: hashedPassword,
          },
        }
      );

      return true;
    },

    forgetUserPassword: async (
      _,
      { userEmail, oldPassword, newPassword },
      { db }
    ) => {
      const user = await db.collection("Users").findOne({ email: userEmail });

      if (!user) {
        throw new Error("User doesn't exist!");
      }

      const isPasswordCorrect = bcrypt.compareSync(oldPassword, user.password);

      if (!isPasswordCorrect) {
        throw new Error("Password not correct");
      }

      const newHashedPassword = bcrypt.hashSync(newPassword);

      await db.collection("Users").updateOne(
        { _id: user._id },
        {
          $set: {
            password: newHashedPassword,
          },
        }
      );

      return true;
    },

    updateAvatar: async (_, { newAvatar }, { db, user }) => {
      if (!user) {
        throw new Error("Authentication error, please sign in");
      }

      await db.collection("Users").updateOne(
        { _id: user._id },
        {
          $set: {
            avatar: newAvatar,
          },
        }
      );

      return true;
    },

    createProject: async (_, { title }, { db, user }) => {
      if (!user) {
        throw new Error("Authentication error, please sign in");
      }
      console.log(user._id);
      const newProject = {
        title,
        createdAt: new Date().toISOString(),
        userIds: [user._id],
        progress: 0,
      };

      const result = await db.collection("Projects").insertOne(newProject);
      console.log(newProject);
      return newProject;
    },

    updateProject: async (_, { _id, title }, { db, user }) => {
      if (!user) {
        throw new Error("Authentication error, please sign in");
      }

      await db.collection("Projects").updateOne(
        { _id: ObjectId(_id) },
        {
          $set: {
            title,
          },
        }
      );

      return await db.collection("Projects").findOne({ _id: ObjectId(_id) });
    },

    deleteProject: async (_, { _id }, { db, user }) => {
      if (!user) {
        throw new Error("Authentication error, please sign in");
      }

      await db.collection("Projects").deleteOne({ _id: ObjectId(_id) });
      return true;
    },

    deleteAllProjects: async (_, __, { db, user }) => {
      if (!user) {
        throw new Error("Authentication error, please sign in");
      }

      await db.collection("Projects").deleteMany({ userIds: user._id });
      return true;
    },

    addUserToProject: async (_, { projectId, userEmail }, { db, user }) => {
      if (!user) {
        throw new Error("Authentication error, please sign in");
      }

      const addedUser = await db
        .collection("Users")
        .findOne({ email: userEmail });

      if (!addedUser) {
        throw new Error("user doesn't exist");
      }

      await db.collection("Projects").updateOne(
        { _id: ObjectId(projectId) },
        {
          $push: {
            userIds: addedUser._id,
          },
        }
      );

      return await db
        .collection("Projects")
        .findOne({ _id: ObjectId(projectId) });
    },

    deleteUserFromProject: async (_, { projectId, userId }, { db, user }) => {
      if (!user) {
        throw new Error("Authentication error, please sign in");
      }

      const userEmail = await db
        .collection("Users")
        .findOne({ _id: ObjectId(userId) });

      if (userEmail.email === user.email) {
        throw new Error("You can not delete yourself from your own project!");
      }

      await db.collection("Projects").updateOne(
        { _id: ObjectId(projectId) },
        {
          $pull: {
            userIds: ObjectId(userId),
          },
        }
      );
      return true;
    },

    createTaskList: async (_, { content, projectId }, { db, user }) => {
      if (!user) {
        throw new Error("Authentication error, please sign in");
      }

      const newTaskList = {
        content,
        projectId: ObjectId(projectId),
        isCompleted: false,
      };

      const result = await db.collection("TaskLists").insertOne(newTaskList);
      console.log(newTaskList);
      return newTaskList;
    },

    updateTaskList: async (_, { _id, content, isCompleted }, { db, user }) => {
      if (!user) {
        throw new Error("Authentication error, please sign in");
      }

      await db.collection("TaskLists").updateOne(
        { _id: ObjectId(_id) },
        {
          $set: {
            content,
            isCompleted,
          },
        }
      );

      return await db.collection("TaskLists").findOne({ _id: ObjectId(_id) });
    },

    deleteTaskList: async (_, { _id }, { db, user }) => {
      if (!user) {
        throw new Error("Authentication error, please sign in");
      }

      await db.collection("TaskLists").deleteOne({ _id: ObjectId(_id) });
      return true;
    },

    deleteAllTasks: async (_, { projectId }, { db, user }) => {
      if (!user) {
        throw new Error("Authentication error, please sign in");
      }

      await db
        .collection("TaskLists")
        .deleteMany({ projectId: ObjectId(projectId) });
      return true;
    },
  },

  Project: {
    progress: async ({ _id }, _, { db }) => {
      const taskLists = await db
        .collection("TaskLists")
        .find({ projectId: ObjectId(_id) })
        .toArray();
      const completed = taskLists.filter((taskList) => taskList.isCompleted);

      if (taskLists.length === 0) {
        return 0;
      }

      return (100 * completed.length) / taskLists.length;
    },
    users: async ({ userIds }, _, { db }) =>
      Promise.all(
        userIds.map((userId) => db.collection("Users").findOne({ _id: userId }))
      ),
    taskLists: async ({ _id }, _, { db }) =>
      await db
        .collection("TaskLists")
        .find({ projectId: ObjectId(_id) })
        .toArray(),
  },

  TaskList: {
    project: async ({ projectId }, _, { db }) =>
      db.collection("Projects").findOne({ _id: projectId }),
  },
};

const start = async () => {
  const client = new MongoClient(DB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  try {
    //client.connect();
    client.connect((err) => {});
    const db = client.db(DB_NAME);

    // const context = {
    //   db,
    // };

    const server = new ApolloServer({
      typeDefs,
      resolvers,
      context: async ({ req }) => {
        const user = await getUserFromToken(req.headers.authorization, db);
        //console.log(user, "here");
        return {
          db,
          user,
        };
      },
    });

    // The `listen` method launches a web server. port: process.env.PORT ||
    server.listen({ port: 4000 }).then(({ url }) => {
      console.log(`🚀  Server ready at ${url}`);
    });
  } finally {
    //await client.close();
  }
};

start().catch(console.dir);
