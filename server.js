var express = require("express");
var app = express();

var formidable = require("express-formidable");
app.use(formidable());

var mongodb = require("mongodb");
var mongoClient = mongodb.MongoClient;
var ObjectId = mongodb.ObjectId;

var http = require("http").createServer(app);
var bcrypt = require("bcrypt");
var fileSystem = require("fs");

var jwt = require("jsonwebtoken");
const { group } = require("console");
var accessTokenSecret = "myAccessTokenSecret1234567890";

app.use("/public", express.static(__dirname + "/public"));
app.set("view engine", "ejs");

var socketIO = require("socket.io")(http);
var socketID = "";
var users = [];

var mainURL = "http://localhost:3000";

socketIO.on("connection", function (socket) {
  // console.log("User connected", socket.id);
  socketID = socket.id;
});

http.listen(3000, function () {
  console.log("Server started at " + mainURL);
  //mongodb://localhost:27017/?readPreference=primary&appname=MongoDB%20Compass&ssl=false
  //mongodb+srv://duydt99:123412341234@cluster0.1akit.mongodb.net/test
  mongoClient.connect(
    "mongodb://localhost:27017/?readPreference=primary&appname=MongoDB%20Compass&ssl=false",
    function (error, client) {
      var database = client.db("petsn");
      console.log("Database connected.");

      app.get("/signup", function (request, result) {
        result.render("signup");
      });

      app.post("/signup", function (request, result) {
        var name = request.fields.name;
        var username = request.fields.username;
        var email = request.fields.email;
        var password = request.fields.password;
        var repassword = request.fields.confirm_password;
        var gender = request.fields.gender;
        var reset_token = "";

        database.collection("users").findOne(
          {
            $or: [
              {
                email: email,
              },
              {
                username: username,
              },
            ],
          },
          function (error, user) {
            if (user == null) {
              if (password === repassword) {
                bcrypt.hash(password, 10, function (error, hash) {
                  database.collection("users").insertOne(
                    {
                      name: name,
                      username: username,
                      email: email,
                      password: hash,
                      gender: gender,
                      reset_token: reset_token,
                      profileImage: "public/img/profile.jpg",
                      coverPhoto: "public/img/cover.jpg",
                      dob: "",
                      city: "",
                      job: "",
                      country: "",
                      aboutMe: "",
                      friends: [],
                      pages: [],
                      notifications: [],
                      groups: [],
                      posts: [],
                    },
                    function (error, data) {
                      result.json({
                        status: "success",
                        message: "Signed up successfully. You can login now.",
                      });
                    }
                  );
                });
              } else {
                result.json({
                  status: "error",
                  message: "Confirm password is not correct.",
                });
              }
            } else {
              result.json({
                status: "error",
                message: "Email or username already exist.",
              });
            }
          }
        );
      });

      app.get("/login", function (request, result) {
        result.render("login");
      });

      app.post("/login", function (request, result) {
        var email = request.fields.email;
        var password = request.fields.password;
        database.collection("users").findOne(
          {
            email: email,
          },
          function (error, user) {
            if (user == null) {
              result.json({
                status: "error",
                message: "Email does not exist",
              });
            } else {
              bcrypt.compare(
                password,
                user.password,
                function (error, isVerify) {
                  if (isVerify) {
                    var accessToken = jwt.sign(
                      { email: email },
                      accessTokenSecret
                    );
                    database.collection("users").findOneAndUpdate(
                      {
                        email: email,
                      },
                      {
                        $set: {
                          accessToken: accessToken,
                        },
                      },
                      function (error, data) {
                        result.json({
                          status: "success",
                          message: "Login successfully",
                          accessToken: accessToken,
                          profileImage: user.profileImage,
                        });
                      }
                    );
                  } else {
                    result.json({
                      status: "error",
                      message: "Password is not correct",
                    });
                  }
                }
              );
            }
          }
        );
      });

      app.get("/user/:username", function (request, result) {
        database.collection("users").findOne(
          {
            username: request.params.username,
          },
          function (error, user) {
            if (user == null) {
              result.send({
                status: "error",
                message: "User does not exists",
              });
            } else {
              result.render("userProfile", {
                user: user,
              });
            }
          }
        );
      });

      app.get("/updateProfile", function (request, result) {
        result.render("updateProfile");
      });
      app.get("/timeline", function (request, result) {
        result.render("timeline");
      });

      app.post("/getUser", function (request, result) {
        var accessToken = request.fields.accessToken;
        database.collection("users").findOne(
          {
            accessToken: accessToken,
          },
          function (error, user) {
            if (user == null) {
              result.json({
                status: "error",
                message: "User has been logged out. Please login again.",
              });
            } else {
              result.json({
                status: "success",
                message: "Record has been fetched.",
                data: user,
              });
            }
          }
        );
      });

      app.get("/logout", function (request, result) {
        result.redirect("/login");
      });

      app.post("/uploadCoverPhoto", function (request, result) {
        var accessToken = request.fields.accessToken;
        var coverPhoto = "";

        database.collection("users").findOne(
          {
            accessToken: accessToken,
          },
          function (error, user) {
            if (user == null) {
              result.json({
                status: "error",
                message: "User has been logged out. Please login again.",
              });
            } else {
              if (
                request.files.coverPhoto.size > 0 &&
                request.files.coverPhoto.type.includes("image")
              ) {
                if (
                  user.coverPhoto != "" &&
                  user.coverPhoto != "public/img/cover.jpg"
                ) {
                  fileSystem.unlink(user.coverPhoto, function (error) {
                    //
                  });
                }

                coverPhoto =
                  "public/images/" +
                  new Date().getTime() +
                  "-" +
                  request.files.coverPhoto.name;
                fileSystem.rename(
                  request.files.coverPhoto.path,
                  coverPhoto,
                  function (error) {
                    //
                  }
                );

                database.collection("users").updateOne(
                  {
                    accessToken: accessToken,
                  },
                  {
                    $set: {
                      coverPhoto: coverPhoto,
                    },
                  },
                  function (error, data) {
                    result.json({
                      status: "status",
                      message: "Cover photo has been updated.",
                      data: mainURL + "/" + coverPhoto,
                    });
                  }
                );
              } else {
                result.json({
                  status: "error",
                  message: "Please select valid image.",
                });
              }
            }
          }
        );
      });

      app.post("/uploadProfileImage", function (request, result) {
        var accessToken = request.fields.accessToken;
        var profileImage = "";

        database.collection("users").findOne(
          {
            accessToken: accessToken,
          },
          function (error, user) {
            if (user == null) {
              result.json({
                status: "error",
                message: "User has been logged out. Please login again.",
              });
            } else {
              if (
                request.files.profileImage.size > 0 &&
                request.files.profileImage.type.includes("image")
              ) {
                if (
                  user.profileImage != "" &&
                  user.profileImage != "public/img/profile.jpg"
                ) {
                  fileSystem.unlink(user.profileImage, function (error) {
                    //
                  });
                }

                profileImage =
                  "public/images/" +
                  new Date().getTime() +
                  "-" +
                  request.files.profileImage.name;
                fileSystem.rename(
                  request.files.profileImage.path,
                  profileImage,
                  function (error) {
                    //
                  }
                );

                database.collection("users").updateOne(
                  {
                    accessToken: accessToken,
                  },
                  {
                    $set: {
                      profileImage: profileImage,
                    },
                  },
                  function (error, data) {
                    result.json({
                      status: "status",
                      message: "Profile image has been updated.",
                      data: mainURL + "/" + profileImage,
                    });
                  }
                );
              } else {
                result.json({
                  status: "error",
                  message: "Please select valid image.",
                });
              }
            }
          }
        );
      });

      app.post("/updateProfile", function (request, result) {
        var accessToken = request.fields.accessToken;
        var name = request.fields.name;
        var dob = request.fields.dob;
        var city = request.fields.city;
        var country = request.fields.country;
        var aboutMe = request.fields.aboutMe;
        var job = request.fields.job;

        database.collection("users").findOne(
          {
            accessToken: accessToken,
          },
          function (error, user) {
            if (user == null) {
              result.json({
                status: "error",
                message: "User has been logged out. Please login again.",
              });
            } else {
              database.collection("users").updateOne(
                {
                  accessToken: accessToken,
                },
                {
                  $set: {
                    name: name,
                    dob: dob,
                    city: city,
                    country: country,
                    aboutMe: aboutMe,
                    job: job,
                  },
                },
                function (error, data) {
                  result.json({
                    status: "status",
                    message: "Profile has been updated.",
                  });
                }
              );
            }
          }
        );
      });

      app.get("/post/:id", function (request, result) {
        database.collection("posts").findOne(
          {
            _id: ObjectId(request.params.id),
          },
          function (error, post) {
            if (post == null) {
              result.send({
                status: "error",
                message: "Post does not exist.",
              });
            } else {
              result.render("postDetail", {
                post: post,
              });
            }
          }
        );
      });

      app.get("/", function (request, result) {
        result.render("index");
      });

      app.post("/addPost", function (request, result) {
        var accessToken = request.fields.accessToken;
        var caption = request.fields.caption;
        var image = "";
        var video = "";
        var type = request.fields.type;
        var createdAt = new Date().getTime();
        var _id = request.fields._id;

        database.collection("users").findOne(
          {
            accessToken: accessToken,
          },
          function (error, user) {
            if (user == null) {
              result.json({
                status: "error",
                message: "User has been logged out. Please login again.",
              });
            } else {
              if (
                request.files.image.size > 0 &&
                request.files.image.type.includes("image")
              ) {
                image =
                  "public/images/" +
                  new Date().getTime() +
                  "-" +
                  request.files.image.name;
                fileSystem.rename(
                  request.files.image.path,
                  image,
                  function (error) {
                    //
                  }
                );
              }

              if (
                request.files.video.size > 0 &&
                request.files.video.type.includes("video")
              ) {
                video =
                  "public/videos/" +
                  new Date().getTime() +
                  "-" +
                  request.files.video.name;
                fileSystem.rename(
                  request.files.video.path,
                  video,
                  function (error) {
                    //
                  }
                );
              }

              // add type for pagepost
              if (type == "page_post") {
                database.collection("pages").findOne(
                  {
                    _id: ObjectId(_id),
                  },
                  function (error, page) {
                    if (page == null) {
                      result.json({
                        status: "error",
                        message: "Page does not exist.",
                      });
                      return;
                    } else {
                      if (page.user._id.toString() != user._id.toString()) {
                        result.json({
                          status: "error",
                          message: "Sorry, you do not own this page.",
                        });
                        return;
                      }
                      database.collection("posts").insertOne(
                        {
                          caption: caption,
                          image: image,
                          video: video,
                          type: type,
                          createdAt: createdAt,
                          likers: [],
                          comments: [],
                          shares: [],
                          user: {
                            _id: page._id,
                            name: page.name,
                            profileImage: page.coverPhoto,
                          },
                        },
                        function (error, data) {
                          result.json({
                            status: "success",
                            message: "Post has been uploaded.",
                          });
                        }
                      );
                    }
                  }
                );
              }
              // add type for grouppost
              else if (type == "group_post") {
                database.collection("groups").findOne(
                  {
                    _id: ObjectId(_id),
                  },
                  function (error, group) {
                    if (group == null) {
                      result.json({
                        status: "error",
                        message: "Group does not exist.",
                      });
                      return;
                    } else {
                      var isMember = false;
                      for (var a = 0; a < group.members.length; a++) {
                        var member = group.members[a];

                        if (member._id.toString() == user._id.toString()) {
                          isMember = true;
                          break;
                        }
                      }
                      if (!isMember) {
                        result.json({
                          status: "error",
                          message: "Sorry, you are not a member of this group",
                        });
                        return;
                      }
                      database.collection("posts").insertOne(
                        {
                          caption: caption,
                          image: image,
                          video: video,
                          type: type,
                          createdAt: createdAt,
                          likers: [],
                          comments: [],
                          shares: [],
                          user: {
                            _id: group._id,
                            name: group.name,
                            profileImage: group.coverPhoto,
                          },
                          uploader: {
                            _id: user._id,
                            name: user.name,
                            username: user.username,
                            profileImage: user.coverPhoto,
                          },
                        },
                        function (error, data) {
                          result.json({
                            status: "success",
                            message: "Post has been uploaded.",
                          });
                        }
                      );
                    }
                  }
                );
              } else {
                database.collection("posts").insertOne(
                  {
                    caption: caption,
                    image: image,
                    video: video,
                    type: type,
                    createdAt: createdAt,
                    likers: [],
                    comments: [],
                    shares: [],
                    user: {
                      _id: user._id,
                      name: user.name,
                      username: user.username,
                      profileImage: user.profileImage,
                    },
                  },
                  function (error, data) {
                    database.collection("users").updateOne(
                      {
                        accessToken: accessToken,
                      },
                      {
                        $push: {
                          posts: {
                            _id: data.insertedId,
                            caption: caption,
                            image: image,
                            video: video,
                            type: type,
                            createdAt: createdAt,
                            likers: [],
                            comments: [],
                            shares: [],
                          },
                        },
                      },
                      function (error, data) {
                        result.json({
                          status: "success",
                          message: "Post has been uploaded.",
                        });
                      }
                    );
                  }
                );
              }
            }
          }
        );
      });

      app.post("/getNewsfeed", function (request, result) {
        var accessToken = request.fields.accessToken;
        database.collection("users").findOne(
          {
            accessToken: accessToken,
          },
          function (error, user) {
            if (user == null) {
              result.json({
                status: "error",
                message: "User has been logged out. Please login again.",
              });
            } else {
              var ids = [];
              ids.push(user._id);

              ///get page post in your newsfeed
              for (var a = 0; a < user.pages.length; a++) {
                ids.push(user.pages[a]._id);
              }
              //get group post in your newsfeed
              for (var a = 0; a < user.groups.length; a++) {
                if (user.groups[a].status == "Accepted") {
                  ids.push(user.groups[a]._id);
                }
              }
              ///get friend post in your newsfeed
              for (var a = 0; a < user.friends.length; a++) {
                ids.push(user.friends[a]._id);
              }

              database
                .collection("posts")
                .find({
                  "user._id": {
                    $in: ids,
                  },
                })
                .sort({
                  createdAt: -1,
                })
                .limit(20)
                .toArray(function (error, data) {
                  result.json({
                    status: "success",
                    message: "Record has been fetched",
                    data: data,
                  });
                });
            }
          }
        );
      });

      app.post("/getTimeline", function (request, result) {
        var accessToken = request.fields.accessToken;
        database.collection("users").findOne(
          {
            accessToken: accessToken,
          },
          function (error, user) {
            if (user == null) {
              result.json({
                status: "error",
                message: "User has been logged out. Please login again.",
              });
            } else {
              var ids = [];
              ids.push(user._id);

              database
                .collection("posts")
                .find({
                  "user._id": {
                    $in: ids,
                  },
                })
                .sort({
                  createdAt: -1,
                })
                .toArray(function (error, data) {
                  result.json({
                    status: "success",
                    message: "Record has been fetched",
                    data: data,
                  });
                });
            }
          }
        );
      });

      app.post("/toggleLikePost", function (request, result) {
        var accessToken = request.fields.accessToken;
        var _id = request.fields._id;

        database.collection("users").findOne(
          {
            accessToken: accessToken,
          },
          function (error, user) {
            if (user == null) {
              result.json({
                status: "error",
                message: "User has been logged out. Please login again.",
              });
            } else {
              database.collection("posts").findOne(
                {
                  _id: ObjectId(_id),
                },
                function (error, post) {
                  if (post == null) {
                    result.json({
                      status: "error",
                      message: "Post does not exist.",
                    });
                  } else {
                    var isLiked = false;
                    for (var a = 0; a < post.likers.length; a++) {
                      var liker = post.likers[a];

                      if (liker._id.toString() == user._id.toString()) {
                        isLiked = true;
                        break;
                      }
                    }

                    if (isLiked) {
                      database.collection("posts").updateOne(
                        {
                          _id: ObjectId(_id),
                        },
                        {
                          $pull: {
                            likers: {
                              _id: user._id,
                            },
                          },
                        },
                        function (error, data) {
                          database.collection("users").updateOne(
                            {
                              $and: [
                                {
                                  _id: post.user._id,
                                },
                                {
                                  "posts._id": post._id,
                                },
                              ],
                            },
                            {
                              $pull: {
                                "posts.$[].likers": {
                                  _id: user._id,
                                },
                              },
                            }
                          );

                          result.json({
                            status: "unliked",
                            message: "Post has been unliked.",
                          });
                        }
                      );
                    } else {
                      database.collection("users").updateOne(
                        {
                          _id: post.user._id,
                        },
                        {
                          $push: {
                            notifications: {
                              _id: ObjectId(),
                              type: "photo_liked",
                              content: user.name + " has liked your post.",
                              profileImage: user.profileImage,
                              isRead: false,
                              post: {
                                _id: post._id,
                              },
                              createdAt: new Date().getTime(),
                            },
                          },
                        }
                      );

                      database.collection("posts").updateOne(
                        {
                          _id: ObjectId(_id),
                        },
                        {
                          $push: {
                            likers: {
                              _id: user._id,
                              name: user.name,
                              profileImage: user.profileImage,
                            },
                          },
                        },
                        function (error, data) {
                          database.collection("users").updateOne(
                            {
                              $and: [
                                {
                                  _id: post.user._id,
                                },
                                {
                                  "posts._id": post._id,
                                },
                              ],
                            },
                            {
                              $push: {
                                "posts.$[].likers": {
                                  _id: user._id,
                                  name: user.name,
                                  profileImage: user.profileImage,
                                },
                              },
                            }
                          );

                          result.json({
                            status: "success",
                            message: "Post has been liked.",
                          });
                        }
                      );
                    }
                  }
                }
              );
            }
          }
        );
      });

      app.post("/postComment", function (request, result) {
        var accessToken = request.fields.accessToken;
        var _id = request.fields._id;
        var comment = request.fields.comment;
        var createdAt = new Date().getTime();

        database.collection("users").findOne(
          {
            accessToken: accessToken,
          },
          function (error, user) {
            if (user == null) {
              result.json({
                status: "error",
                message: "User has been logged out. Please login again.",
              });
            } else {
              database.collection("posts").findOne(
                {
                  _id: ObjectId(_id),
                },
                function (error, post) {
                  if (post == null) {
                    result.json({
                      status: "error",
                      message: "Post does not exist.",
                    });
                  } else {
                    var commentId = ObjectId();

                    database.collection("posts").updateOne(
                      {
                        _id: ObjectId(_id),
                      },
                      {
                        $push: {
                          comments: {
                            _id: commentId,
                            user: {
                              _id: user._id,
                              name: user.name,
                              profileImage: user.profileImage,
                            },
                            comment: comment,
                            createdAt: createdAt,
                            replies: [],
                          },
                        },
                      },
                      function (error, data) {
                        if (user._id.toString() != post.user._id.toString()) {
                          database.collection("users").updateOne(
                            {
                              _id: post.user._id,
                            },
                            {
                              $push: {
                                notifications: {
                                  _id: ObjectId(),
                                  type: "new_comment",
                                  content:
                                    user.name + " commented on your post.",
                                  profileImage: user.profileImage,
                                  post: {
                                    _id: post._id,
                                  },
                                  isRead: false,
                                  createdAt: new Date().getTime(),
                                },
                              },
                            }
                          );
                        }

                        database.collection("users").updateOne(
                          {
                            $and: [
                              {
                                _id: post.user._id,
                              },
                              {
                                "posts._id": post._id,
                              },
                            ],
                          },
                          {
                            $push: {
                              "posts.$[].comments": {
                                _id: commentId,
                                user: {
                                  _id: user._id,
                                  name: user.name,
                                  profileImage: user.profileImage,
                                },
                                comment: comment,
                                createdAt: createdAt,
                                replies: [],
                              },
                            },
                          }
                        );

                        database.collection("posts").findOne(
                          {
                            _id: ObjectId(_id),
                          },
                          function (error, updatePost) {
                            result.json({
                              status: "success",
                              message: "Comment has been posted.",
                              updatePost: updatePost,
                            });
                          }
                        );
                      }
                    );
                  }
                }
              );
            }
          }
        );
      });

      app.post("/postReply", function (request, result) {
        var accessToken = request.fields.accessToken;
        var postId = request.fields.postId;
        var commentId = request.fields.commentId;
        var reply = request.fields.reply;
        var createdAt = new Date().getTime();

        database.collection("users").findOne(
          {
            accessToken: accessToken,
          },
          function (error, user) {
            if (user == null) {
              result.json({
                status: "error",
                message: "User has been logged out. Please login again.",
              });
            } else {
              database.collection("posts").findOne(
                {
                  _id: ObjectId(postId),
                },
                function (error, post) {
                  if (post == null) {
                    result.json({
                      status: "error",
                      message: "Post does not exist.",
                    });
                  } else {
                    var replyId = ObjectId();

                    database.collection("posts").updateOne(
                      {
                        $and: [
                          {
                            _id: ObjectId(postId),
                          },
                          {
                            "comments._id": ObjectId(commentId),
                          },
                        ],
                      },
                      {
                        $push: {
                          "comments.$.replies": {
                            _id: replyId,
                            user: {
                              _id: user._id,
                              name: user.name,
                              profileImage: user.profileImage,
                            },
                            reply: reply,
                            createdAt: createdAt,
                          },
                        },
                      },
                      function (error, data) {
                        database.collection("users").updateOne(
                          {
                            $and: [
                              {
                                _id: post.user._id,
                              },
                              {
                                "posts._id": post._id,
                              },
                              {
                                "posts.comments._id": ObjectId(commentId),
                              },
                            ],
                          },
                          {
                            $push: {
                              "posts.$.comments.$[i].replies": {
                                _id: replyId,
                                user: {
                                  _id: user._id,
                                  name: user.name,
                                  profileImage: user.profileImage,
                                },
                                reply: reply,
                                createdAt: createdAt,
                              },
                            },
                          },
                          {
                            arrayFilters: [{ "i._id": ObjectId(commentId) }],
                          }
                        );

                        database.collection("posts").findOne(
                          {
                            _id: ObjectId(postId),
                          },
                          function (error, updatePost) {
                            result.json({
                              status: "success",
                              message: "Reply has been posted.",
                              updatePost: updatePost,
                            });
                          }
                        );
                      }
                    );
                  }
                }
              );
            }
          }
        );
      });

      app.post("/sharePost", function (request, result) {
        var accessToken = request.fields.accessToken;
        var _id = request.fields._id;
        var type = "shared";
        var createdAt = new Date().getTime();

        database.collection("users").findOne(
          {
            accessToken: accessToken,
          },
          function (error, user) {
            if (user == null) {
              result.json({
                status: "error",
                message: "User has been logged out. Please login again.",
              });
            } else {
              database.collection("posts").findOne(
                {
                  _id: ObjectId(_id),
                },
                function (error, post) {
                  if (post == null) {
                    result.json({
                      status: "error",
                      message: "Post does not exist.",
                    });
                  } else {
                    database.collection("posts").updateOne(
                      {
                        _id: ObjectId(_id),
                      },
                      {
                        $push: {
                          shares: {
                            _id: user._id,
                            name: user.name,
                            profileImage: user.profileImage,
                          },
                        },
                      },
                      function (error, data) {
                        database.collection("posts").insertOne(
                          {
                            caption: post.caption,
                            image: post.image,
                            video: post.video,
                            type: type,
                            createdAt: createdAt,
                            likers: [],
                            comments: [],
                            shares: [],
                            user: {
                              _id: user._id,
                              name: user.name,
                              gender: user.gender,
                              profileImage: user.profileImage,
                            },
                          },
                          function (error, data) {
                            database.collection("users").updateOne(
                              {
                                $and: [
                                  {
                                    _id: post.user._id,
                                  },
                                  {
                                    "posts._id": post._id,
                                  },
                                ],
                              },
                              {
                                $push: {
                                  "posts.$[].shares": {
                                    _id: user._id,
                                    name: user.name,
                                    profileImage: user.profileImage,
                                  },
                                },
                              }
                            );

                            result.json({
                              status: "success",
                              message: "Post has been shared.",
                            });
                          }
                        );
                      }
                    );
                  }
                }
              );
            }
          }
        );
      });

      app.get("/search/:query", function (request, result) {
        var query = request.params.query;
        if (query == "") {
          result.render("index");
        } else {
          result.render("search", {
            query: query,
          });
        }
      });

      app.post("/search", function (request, result) {
        var query = request.fields.query;
        if (query == "") {
          console.log(query);
          result.json({
            status: "error",
            message: "Please type keyword",
          });
        } else {
          database
            .collection("users")
            .find({
              name: {
                $regex: ".*" + query + ".*",
                $options: "i",
              },
            })
            .toArray(function (error, data) {
              //search for group
              database
                .collection("pages")
                .find({
                  name: {
                    $regex: ".*" + query + ".*",
                    $options: "i",
                  },
                })
                .toArray(function (error, pages) {
                  //search group
                  database
                    .collection("groups")
                    .find({
                      name: {
                        $regex: ".*" + query + ".*",
                        $options: "i",
                      },
                    })
                    .toArray(function (error, groups) {
                      result.json({
                        status: "success",
                        message: "Record has been fetched",
                        data: data,
                        pages: pages,
                        groups: groups,
                      });
                    });
                });
            });
        }
      });
      app.post("/sendFriendRequest", function (request, result) {
        var accessToken = request.fields.accessToken;
        var _id = request.fields._id;

        database.collection("users").findOne(
          {
            accessToken: accessToken,
          },
          function (error, user) {
            if (user == null) {
              result.json({
                status: "error",
                message: "User has been logged out. Please login again.",
              });
            } else {
              var me = user;
              database.collection("users").findOne(
                {
                  _id: ObjectId(_id),
                },
                function (error, user) {
                  if (user == null) {
                    result.json({
                      status: "error",
                      message: "User does not exist.",
                    });
                  } else {
                    database.collection("users").updateOne(
                      {
                        _id: ObjectId(_id),
                      },
                      {
                        $push: {
                          friends: {
                            _id: me._id,
                            name: me.name,
                            username: me.username,
                            profileImage: me.profileImage,
                            status: "Pending",
                            sentByMe: false,
                            inbox: [],
                          },
                        },
                      },
                      function (error, data) {
                        database.collection("users").updateOne(
                          {
                            _id: me._id,
                          },
                          {
                            $push: {
                              friends: {
                                _id: user._id,
                                name: user.name,
                                username: user.username,
                                profileImage: user.profileImage,
                                status: "Pending",
                                sentByMe: true,
                                inbox: [],
                              },
                            },
                          },
                          function (error, data) {
                            result.json({
                              status: "success",
                              message: "Friend request has been sent",
                            });
                          }
                        );
                      }
                    );
                  }
                }
              );
            }
          }
        );
      });

      app.post("/acceptFriendRequest", function (request, result) {
        var accessToken = request.fields.accessToken;
        var _id = request.fields._id;

        database.collection("users").findOne(
          {
            accessToken: accessToken,
          },
          function (error, user) {
            if (user == null) {
              result.json({
                status: "error",
                message: "User has been logged out. Please login again.",
              });
            } else {
              var me = user;
              database.collection("users").findOne(
                {
                  _id: ObjectId(_id),
                },
                function (error, user) {
                  if (user == null) {
                    result.json({
                      status: "error",
                      message: "User does not exist.",
                    });
                  } else {
                    database.collection("users").updateOne(
                      {
                        _id: ObjectId(_id),
                      },
                      {
                        $push: {
                          notifications: {
                            _id: ObjectId(),
                            type: "friend request accepted",
                            content: me.name + " accept your friend request.",
                            profileImage: me.profileImage,
                            isRead: true,
                            createdAt: new Date().getTime(),
                          },
                        },
                      }
                    );

                    database.collection("users").updateOne(
                      {
                        $and: [
                          {
                            _id: ObjectId(_id),
                          },
                          {
                            "friends._id": me._id,
                          },
                        ],
                      },
                      {
                        $set: {
                          "friends.$.status": "Accepted",
                        },
                      },
                      function (error, data) {
                        database.collection("users").updateOne(
                          {
                            $and: [
                              {
                                _id: me._id,
                              },
                              {
                                "friends._id": user._id,
                              },
                            ],
                          },
                          {
                            $set: {
                              "friends.$.status": "Accepted",
                            },
                          },
                          function (error, data) {
                            result.json({
                              status: "success",
                              message: "Friend request has been accepted.",
                            });
                          }
                        );
                      }
                    );
                  }
                }
              );
            }
          }
        );
      });
      app.post("/unfriend", function (request, result) {
        var accessToken = request.fields.accessToken;
        var _id = request.fields._id;
        database.collection("users").findOne(
          {
            accessToken: accessToken,
          },
          function (error, user) {
            if (user == null) {
              result.json({
                status: "error",
                message: "User has been logged out. Please login again.",
              });
            } else {
              var me = user;
              database.collection("users").findOne(
                {
                  _id: ObjectId(_id),
                },
                function (error, user) {
                  if (user == null) {
                    result.json({
                      status: "error",
                      message: "User does not exist.",
                    });
                  } else {
                    database.collection("users").updateOne(
                      {
                        _id: ObjectId(_id),
                      },
                      {
                        $pull: {
                          friends: {
                            _id: me._id,
                          },
                        },
                      },
                      function (error, data) {
                        database.collection("users").updateOne(
                          {
                            _id: me._id,
                          },
                          {
                            $pull: {
                              friends: {
                                _id: user._id,
                              },
                            },
                          },
                          function (error, data) {
                            result.json({
                              status: "success",
                              message: "Friend has been remove",
                            });
                          }
                        );
                      }
                    );
                  }
                }
              );
            }
          }
        );
      });
      app.get("/friends", function (request, result) {
        result.render("friends");
      });

      app.get("/inbox", function (request, result) {
        result.render("inbox");
      });
      app.post("/getFriendsChat", function (request, result) {
        var accessToken = request.fields.accessToken;
        console.log(accessToken);
        var _id = request.fields._id;
        console.log(accessToken);

        database.collection("users").findOne(
          {
            accessToken: accessToken,
          },
          function (error, user) {
            if (user == null) {
              result.json({
                status: "error",
                sdf: "wrong",
                message: "User has been logged out. Please login again.",
              });
            } else {
              var index = user.friends.findIndex(function (friend) {
                return friend._id == _id;
              });
              var inbox = user.friends[index].inbox;

              result.json({
                status: "success",
                message: "Record has been fetched",
                data: inbox,
              });
            }
          }
        );
      });
      app.post("/sendMessage", function (request, result) {
        var accessToken = request.fields.accessToken;
        var _id = request.fields._id;
        var message = request.fields.message;
        console.log(message);

        database.collection("users").findOne(
          {
            accessToken: accessToken,
          },
          function (error, user) {
            if (user == null) {
              result.json({
                status: "error",
                message: "User has been logged out. Please login again.",
              });
            } else {
              var me = user;
              database.collection("users").findOne(
                {
                  _id: ObjectId(_id),
                },
                function (error, user) {
                  if (user == null) {
                    result.json({
                      status: "error",
                      message: "User does not exist.",
                    });
                  } else {
                    database.collection("users").updateOne(
                      {
                        $and: [
                          {
                            _id: ObjectId(_id),
                          },
                          {
                            "friends._id": me._id,
                          },
                        ],
                      },
                      {
                        $push: {
                          "friends.$.inbox": {
                            _id: ObjectId(),
                            message: message,
                            from: me._id,
                          },
                        },
                      },
                      function (error, data) {
                        database.collection("users").updateOne(
                          {
                            $and: [
                              {
                                _id: me._id,
                              },
                              {
                                "friends._id": user._id,
                              },
                            ],
                          },
                          {
                            $push: {
                              "friends.$.inbox": {
                                _id: ObjectId(),
                                message: message,
                                from: me._id,
                              },
                            },
                          },
                          function (error, data) {
                            socketIO
                              .to(users[user._id])
                              .emit("messageReceived", {
                                message: message,
                                from: me._id,
                              });
                            result.json({
                              status: "success",
                              message: "Message has been sent.",
                            });
                          }
                        );
                      }
                    );
                  }
                }
              );
            }
          }
        );
      });
      app.post("/connectSocket", function (request, result) {
        var accessToken = request.fields.accessToken;

        database.collection("users").findOne(
          {
            accessToken: accessToken,
          },
          function (error, user) {
            if (user == null) {
              result.json({
                status: "error",
                message: "User has been logged out. Please login again.",
              });
            } else {
              users[user._id] = socketID;
              result.json({
                status: "status",
                message: "Socket has been connected.",
              });
            }
          }
        );
      });
      app.get("/createPage", function (request, result) {
        result.render("createPage");
      });
      app.post("/createPage", function (request, result) {
        var accessToken = request.fields.accessToken;
        var name = request.fields.name;
        var domainName = request.fields.domainName;
        var additionalInfo = request.fields.additionalInfo;
        var coverPhoto = "";

        database.collection("users").findOne(
          {
            accessToken: accessToken,
          },
          function (error, user) {
            if (user == null) {
              result.json({
                status: "error",
                message: "User has been logged out. Please login again.",
              });
            } else {
              if (
                request.files.coverPhoto.size > 0 &&
                request.files.coverPhoto.type.includes("image")
              ) {
                coverPhoto =
                  "public/images/" +
                  new Date().getTime() +
                  "-" +
                  request.files.coverPhoto.name;
                fileSystem.rename(
                  request.files.coverPhoto.path,
                  coverPhoto,
                  function (error) {
                    //
                  }
                );

                database.collection("pages").insertOne(
                  {
                    name: name,
                    domainName: domainName,
                    additionalInfo: additionalInfo,
                    coverPhoto: coverPhoto,
                    likers: [],
                    user: {
                      _id: user._id,
                      name: user.name,
                      profileImage: user.profileImage,
                    },
                  },
                  function (error, data) {
                    result.json({
                      status: "success",
                      message: "Page has been created.",
                    });
                  }
                );
              } else {
                result.json({
                  status: "error",
                  message: "Please selct a cover photo.",
                });
              }
            }
          }
        );
      });
      app.get("/pages", function (request, result) {
        result.render("pages");
      });
      app.post("/getPages", function (request, result) {
        var accessToken = request.fields.accessToken;

        database.collection("users").findOne(
          {
            accessToken: accessToken,
          },
          function (error, user) {
            if (user == null) {
              result.json({
                status: "error",
                message: "User has been logged out. Please login again.",
              });
            } else {
              database
                .collection("pages")
                .find({
                  $or: [
                    {
                      "user._id": user._id,
                    },
                    {
                      "likers._id": user._id,
                    },
                  ],
                })
                .toArray(function (error, data) {
                  result.json({
                    status: "success",
                    message: "Record has been fectched.",
                    data: data,
                  });
                });
            }
          }
        );
      });
      app.get("/page/:_id", function (request, result) {
        var _id = request.params._id;
        database.collection("pages").findOne(
          {
            _id: ObjectId(_id),
          },
          function (error, page) {
            if (page == null) {
              result.json({
                status: "error",
                message: "Page does not exists",
              });
            } else {
              result.render("singlePage", {
                _id: _id,
              });
            }
          }
        );
      });
      app.post("/getPageDetail", function (request, result) {
        var _id = request.fields._id;
        database.collection("pages").findOne(
          {
            _id: ObjectId(_id),
          },
          function (error, page) {
            if (page == null) {
              result.json({
                status: "error",
                message: "Page does not exists",
              });
            } else {
              database
                .collection("posts")
                .find({
                  $and: [
                    {
                      "user._id": page._id,
                    },
                    {
                      type: "page_post",
                    },
                  ],
                })
                .toArray(function (error, posts) {
                  result.json({
                    status: "success",
                    message: "Record has been fetched.",
                    data: page,
                    posts: posts,
                  });
                });
            }
          }
        );
      });
      app.post("/toggleLikePage", function (request, result) {
        var accessToken = request.fields.accessToken;
        var _id = request.fields._id;

        database.collection("users").findOne(
          {
            accessToken: accessToken,
          },
          function (error, user) {
            if (user == null) {
              result.json({
                status: "error",
                message: "User has been logged out. Please login again.",
              });
            } else {
              database.collection("pages").findOne(
                {
                  _id: ObjectId(_id),
                },
                function (error, page) {
                  if (page == null) {
                    result.json({
                      status: "error",
                      message: "Page does not exits.",
                    });
                  } else {
                    var isLiked = false;
                    for (var a = 0; a < page.likers.length; a++) {
                      var liker = page.likers[a];
                      if (liker._id.toString() == user._id.toString()) {
                        isLiked = true;
                        break;
                      }
                    }
                    if (isLiked) {
                      database.collection("pages").updateOne(
                        {
                          _id: ObjectId(_id),
                        },
                        {
                          $pull: {
                            likers: {
                              _id: user._id,
                            },
                          },
                        },
                        function (error, data) {
                          database.collection("users").updateOne(
                            {
                              accessToken: accessToken,
                            },
                            {
                              $pull: {
                                pages: {
                                  _id: ObjectId(_id),
                                },
                              },
                            },
                            function (error, data) {
                              result.json({
                                status: "unliked",
                                message: "Page has been unliked.",
                              });
                            }
                          );
                        }
                      );
                    } else {
                      database.collection("pages").updateOne(
                        {
                          _id: ObjectId(_id),
                        },
                        {
                          $push: {
                            likers: {
                              _id: user._id,
                              name: user.name,
                              profileImage: user.profileImage,
                            },
                          },
                        },
                        function (error, data) {
                          database.collection("users").updateOne(
                            {
                              accessToken: accessToken,
                            },
                            {
                              $push: {
                                pages: {
                                  _id: page._id,
                                  name: page.name,
                                  coverPhoto: page.coverPhoto,
                                },
                              },
                            },
                            function (error, data) {
                              result.json({
                                status: "success",
                                message: "Page has been unliked.",
                              });
                            }
                          );
                        }
                      );
                    }
                  }
                }
              );
            }
          }
        );
      });
      app.post("/getMyPages", function (request, result) {
        var accessToken = request.fields.accessToken;

        database.collection("users").findOne(
          {
            accessToken: accessToken,
          },
          function (error, user) {
            if (user == null) {
              result.json({
                status: "error",
                message: "User has been logged out. Please login again.",
              });
            } else {
              database
                .collection("pages")
                .find({
                  "user._id": user._id,
                })
                .toArray(function (error, data) {
                  result.json({
                    status: "success",
                    message: "Record has been fetched.",
                    data: data,
                  });
                });
            }
          }
        );
      });
      app.get("/groups", function (request, result) {
        result.render("groups");
      });
      app.get("/createGroup", function (request, result) {
        result.render("createGroup");
      });
      app.post("/createGroup", function (request, result) {
        var accessToken = request.fields.accessToken;
        var name = request.fields.name;
        var additionalInfo = request.fields.additionalInfo;
        var coverPhoto = "";

        database.collection("users").findOne(
          {
            accessToken: accessToken,
          },
          function (error, user) {
            if (user == null) {
              result.json({
                status: "error",
                message: "User has been logged out. Please login again.",
              });
            } else {
              if (
                request.files.coverPhoto.size > 0 &&
                request.files.coverPhoto.type.includes("image")
              ) {
                coverPhoto =
                  "public/images/" +
                  new Date().getTime() +
                  "-" +
                  request.files.coverPhoto.name;
                fileSystem.rename(
                  request.files.coverPhoto.path,
                  coverPhoto,
                  function (error) {
                    //
                  }
                );

                database.collection("groups").insertOne(
                  {
                    name: name,
                    additionalInfo: additionalInfo,
                    coverPhoto: coverPhoto,
                    members: [
                      {
                        _id: user._id,
                        name: user.name,
                        profileImage: user.profileImage,
                        status: "Accepted",
                      },
                    ],
                    user: {
                      _id: user._id,
                      name: user.name,
                      profileImage: user.profileImage,
                    },
                  },
                  function (error, data) {
                    database.collection("users").updateOne(
                      {
                        accessToken: accessToken,
                      },
                      {
                        $push: {
                          groups: {
                            _id: data.insertedId,
                            name: name,
                            coverPhoto: coverPhoto,
                            status: "Accepted",
                          },
                        },
                      },
                      function (error, data) {
                        result.json({
                          status: "success",
                          message: "Group has been created.",
                        });
                      }
                    );
                  }
                );
              } else {
                result.json({
                  status: "error",
                  message: "Please selct a cover photo.",
                });
              }
            }
          }
        );
      });
      app.post("/getGroups", function (request, result) {
        var accessToken = request.fields.accessToken;

        database.collection("users").findOne(
          {
            accessToken: accessToken,
          },
          function (error, user) {
            if (user == null) {
              result.json({
                status: "error",
                message: "User has been logged out. Please login again.",
              });
            } else {
              database
                .collection("groups")
                .find({
                  $or: [
                    {
                      "user._id": user._id,
                    },
                    {
                      "members._id": user._id,
                    },
                  ],
                })
                .toArray(function (error, data) {
                  result.json({
                    status: "success",
                    message: "Record has been fetched.",
                    data: data,
                  });
                });
            }
          }
        );
      });
      app.get("/group/:_id", function (request, result) {
        var _id = request.params._id;
        database.collection("groups").findOne(
          {
            _id: ObjectId(_id),
          },
          function (error, group) {
            if (group == null) {
              result.json({
                status: "error",
                message: "Group does not exists",
              });
            } else {
              result.render("singleGroup", {
                _id: _id,
              });
            }
          }
        );
      });
      app.post("/getGroupDetail", function (request, result) {
        var _id = request.fields._id;
        database.collection("groups").findOne(
          {
            _id: ObjectId(_id),
          },
          function (error, group) {
            if (group == null) {
              result.json({
                status: "error",
                message: "Group does not exists",
              });
            } else {
              database
                .collection("posts")
                .find({
                  $and: [
                    {
                      "user._id": group._id,
                    },
                    {
                      type: "group_post",
                    },
                  ],
                })
                .toArray(function (error, posts) {
                  result.json({
                    status: "success",
                    message: "Record has been fetched.",
                    data: group,
                    posts: posts,
                  });
                });
            }
          }
        );
      });
      app.post("/toggleJoinGroup", function (request, result) {
        var accessToken = request.fields.accessToken;
        var _id = request.fields._id;

        database.collection("users").findOne(
          {
            accessToken: accessToken,
          },
          function (error, user) {
            if (user == null) {
              result.json({
                status: "error",
                message: "User has been logged out. Please login again.",
              });
            } else {
              database.collection("groups").findOne(
                {
                  _id: ObjectId(_id),
                },
                function (error, group) {
                  if (group == null) {
                    result.json({
                      status: "error",
                      message: "Group does not exits.",
                    });
                  } else {
                    var isMember = false;
                    for (var a = 0; a < group.members.length; a++) {
                      var member = group.members[a];
                      if (member._id.toString() == user._id.toString()) {
                        isMember = true;
                        break;
                      }
                    }
                    if (isMember) {
                      if (group.user._id.toString() == user._id.toString()) {
                        result.json({
                          status: "error",
                          message:
                            "Oops, You are an admin of this group. You can't leave",
                        });
                        return;
                      } else {
                        database.collection("groups").updateOne(
                          {
                            _id: ObjectId(_id),
                          },
                          {
                            $pull: {
                              members: {
                                _id: user._id,
                              },
                            },
                          },
                          function (error, data) {
                            database.collection("users").updateOne(
                              {
                                accessToken: accessToken,
                              },
                              {
                                $pull: {
                                  groups: {
                                    _id: ObjectId(_id),
                                  },
                                },
                              },
                              function (error, data) {
                                database.collection("users").updateOne(
                                  {
                                    _id: group.user._id,
                                  },
                                  {
                                    $pull: {
                                      notifications: {
                                        groupId: group._id,
                                      },
                                    },
                                  },
                                  function (error, data) {
                                    result.json({
                                      status: "leaved",
                                      message: "Group has been left.",
                                    });
                                  }
                                );
                              }
                            );
                          }
                        );
                      }
                    } else {
                      database.collection("groups").updateOne(
                        {
                          _id: ObjectId(_id),
                        },
                        {
                          $push: {
                            members: {
                              _id: user._id,
                              name: user.name,
                              profileImage: user.profileImage,
                              status: "Pending",
                            },
                          },
                        },
                        function (error, data) {
                          database.collection("users").updateOne(
                            {
                              accessToken: accessToken,
                            },
                            {
                              $push: {
                                groups: {
                                  _id: group._id,
                                  name: group.name,
                                  coverPhoto: group.coverPhoto,
                                  status: "Pending",
                                },
                              },
                            },
                            function (error, data) {
                              database.collection("users").updateOne(
                                {
                                  _id: group.user._id,
                                },
                                {
                                  $push: {
                                    notifications: {
                                      _id: ObjectId(),
                                      type: "group_join_request",
                                      content:
                                        user.name +
                                        " sent a request to join your group.",
                                      profileImage: user.profileImage,
                                      groupId: group._id,
                                      userId: user._id,
                                      status: "Pending",
                                      isRead: false,
                                      createdAt: new Date().getTime(),
                                    },
                                  },
                                }
                              );
                              result.json({
                                status: "success",
                                message: "Request to join group has been sent.",
                              });
                            }
                          );
                        }
                      );
                    }
                  }
                }
              );
            }
          }
        );
      });
      app.post("/acceptRequestJoinGroup", function (request, result) {
        var accessToken = request.fields.accessToken;
        var _id = request.fields._id;
        var groupId = request.fields.groupId;
        var userId = request.fields.userId;

        database.collection("users").findOne(
          {
            accessToken: accessToken,
          },
          function (error, user) {
            if (user == null) {
              result.json({
                status: "error",
                message: "User has been logged out. Please login again.",
              });
            } else {
              database.collection("groups").findOne(
                {
                  _id: ObjectId(groupId),
                },
                function (error, group) {
                  if (group == null) {
                    result.json({
                      status: "error",
                      message: "Group does not exist.",
                    });
                  } else {
                    if (group.user._id.toString() != user._id.toString()) {
                      result.json({
                        status: "error",
                        message: "Sorry, you are not an admin of this group.",
                      });
                      return;
                    }
                    database.collection("groups").updateOne(
                      {
                        $and: [
                          {
                            _id: group._id,
                          },
                          {
                            "members._id": ObjectId(userId),
                          },
                        ],
                      },
                      {
                        $set: {
                          "members.$.status": "Accepted",
                        },
                      },
                      function (error, data) {
                        database.collection("users").updateOne(
                          {
                            $and: [
                              {
                                accessToken: accessToken,
                              },
                              {
                                "notifications.groupId": group._id,
                              },
                            ],
                          },
                          {
                            $set: {
                              "notifications.$.status": "Accepted",
                            },
                          },
                          function (error, data) {
                            database.collection("users").updateOne(
                              {
                                $and: [
                                  {
                                    _id: ObjectId(userId),
                                  },
                                  {
                                    "groups._id": group._id,
                                  },
                                ],
                              },
                              {
                                $set: {
                                  "groups.$.status": "Accepted",
                                },
                              },
                              function (error, data) {
                                result.json({
                                  status: "success",
                                  message:
                                    "Group join request has been accepted.",
                                });
                              }
                            );
                          }
                        );
                      }
                    );
                  }
                }
              );
            }
          }
        );
      });
      app.post("/rejectRequestJoinGroup", function (request, result) {
        var accessToken = request.fields.accessToken;
        var _id = request.fields._id;
        var groupId = request.fields.groupId;
        var userId = request.fields.userId;

        database.collection("users").findOne(
          {
            accessToken: accessToken,
          },
          function (error, user) {
            if (user == null) {
              result.json({
                status: "error",
                message: "User has been logged out. Please login again.",
              });
            } else {
              database.collection("groups").findOne(
                {
                  _id: ObjectId(groupId),
                },
                function (error, group) {
                  if (group == null) {
                    result.json({
                      status: "error",
                      message: "Group does not exist.",
                    });
                  } else {
                    if (group.user._id.toString() != user._id.toString()) {
                      result.json({
                        status: "error",
                        message: "Sorry, you are not an admin of this group.",
                      });
                      return;
                    }
                    database.collection("groups").updateOne(
                      {
                        _id: group._id,
                      },
                      {
                        $pull: {
                          members: {
                            _id: ObjectId(userId),
                          },
                        },
                      },
                      function (error, data) {
                        database.collection("users").updateOne(
                          {
                            accessToken: accessToken,
                          },
                          {
                            $pull: {
                              notifications: {
                                groupId: group._id,
                              },
                            },
                          },
                          function (error, data) {
                            database.collection("users").updateOne(
                              {
                                _id: ObjectId(userId),
                              },
                              {
                                $pull: {
                                  groups: {
                                    _id: group._id,
                                  },
                                },
                              },
                              function (error, data) {
                                result.json({
                                  status: "success",
                                  message:
                                    "Group join request has been rejected.",
                                });
                              }
                            );
                          }
                        );
                      }
                    );
                  }
                }
              );
            }
          }
        );
      });
      app.get("/notifications", function (request, result) {
        result.render("notifications");
      });

      app.post("/markNotificationsAsRead", function (request, result) {
        var accessToken = request.fields.accessToken;

        database.collection("users").findOne(
          {
            accessToken: accessToken,
          },
          function (error, user) {
            if (user == null) {
              result.json({
                status: "error",
                message: "User has been logged out. Please login again.",
              });
            } else {
              database.collection("users").updateMany(
                {
                  $and: [
                    {
                      accessToken: accessToken,
                    },
                    {
                      "notifications.isRead": false,
                    },
                  ],
                },
                {
                  $set: {
                    "notifications.$.isRead": true,
                  },
                },
                function (error, data) {
                  result.json({
                    status: "success",
                    message: "Notifications has been marked as read.",
                  });
                }
              );
            }
          }
        );
      });

      app.get(
        "/verifyEmail/:email/:verification_token",
        function (request, result) {}
      );

      app.get(
        "/ResetPassword/:email/:reset_token",
        function (request, result) {}
      );

      app.get("/forgot-password", function (request, result) {});

      app.post("/sendRecoveryLink", function (request, result) {});

      // app.post("/changePassword", function (request, result) {

      // });

      ////
      app.get("/contact", function (request, result) {
        result.render("contact");
      });
      app.get("/faq", function (request, result) {
        result.render("faq");
      });
      app.get("/groupsSuggest", function (request, result) {
        result.render("suggestGroups");
      });
      app.get("/pagesSuggest", function (request, result) {
        result.render("suggestPages");
      });
      app.get("/friendSuggest", function (request, result) {
        result.render("suggestFriends");
      });
      app.post("/getSuggestGroups", function (request, result) {
        var accessToken = request.fields.accessToken;
        database.collection("users").findOne(
          {
            accessToken: accessToken,
          },
          function (error, user) {
            if (user == null) {
              result.json({
                status: "error",
                message: "User has been logged out. Please login again.",
              });
            } else {
              database
                .collection("groups")
                .aggregate([{ $sample: { size: 10 } }])
                .toArray(function (error, data) {
                  result.json({
                    status: "success",
                    message: "Record has been fetched.",
                    data: data,
                  });
                });
            }
          }
        );
      });
      app.post("/getSuggestPages", function (request, result) {
        var accessToken = request.fields.accessToken;
        database.collection("users").findOne(
          {
            accessToken: accessToken,
          },
          function (error, user) {
            if (user == null) {
              result.json({
                status: "error",
                message: "User has been logged out. Please login again.",
              });
            } else {
              database
                .collection("pages")
                .aggregate([{ $sample: { size: 10 } }])
                .toArray(function (error, data) {
                  result.json({
                    status: "success",
                    message: "Record has been fetched.",
                    data: data,
                  });
                });
            }
          }
        );
      });
      app.post("/getSuggestFriends", function (request, result) {
        var accessToken = request.fields.accessToken;
        database.collection("users").findOne(
          {
            accessToken: accessToken,
          },
          function (error, user) {
            if (user == null) {
              result.json({
                status: "error",
                message: "User has been logged out. Please login again.",
              });
            } else {
              database
                .collection("users")
                .aggregate([{ $sample: { size: 10 } }])
                .toArray(function (error, data) {
                  result.json({
                    status: "success",
                    message: "Record has been fetched.",
                    data: data,
                  });
                });
            }
          }
        );
      });
      //changepassword
      app.get("/changePassword", function (request, result) {
        result.render("changePassword");
      });
      app.post("/changePassword", function (request, result) {
        var accessToken = request.fields.accessToken;
        var oldpassword = request.fields.oldpassword;
        var password = request.fields.newpassword;
        var repassword = request.fields.renewpassword;
        // console.log(password +" and  "+repassword);
        database.collection("users").findOne(
          {
            accessToken: accessToken,
          },
          function (error, user) {
            if (user == null) {
              result.json({
                status: "error",
                message: "User has been logged out. Please login again.",
              });
            } else {
              bcrypt.compare(
                oldpassword,
                user.password,
                function (error, isVerify) {
                  if (isVerify) {
                    if (password === repassword) {
                      bcrypt.hash(password, 10, function (error, hash) {
                        database.collection("users").updateOne(
                          {
                            accessToken: accessToken,
                          },
                          {
                            $set: {
                              password: hash,
                            },
                          },
                          function (error, data) {
                            result.json({
                              status: "success",
                              message: "Change password successfully",
                            });
                          }
                        );
                      });
                    } else {
                      result.json({
                        status: "error",
                        message: "Confirm password is not correct.",
                      });
                    }
                  } else {
                    result.json({
                      status: "error",
                      message: "Password is not correct",
                    });
                  }
                }
              );
            }
          }
        );
      });
      // app.get("/getAll", function (request, result) {
      // 	result.render("getAll");
      // 	database.collection("users").findOneAndUpdate({
      // 		"coverPhoto":""
      // 	},{
      // 		$set:{

      // 			"profileImage": "public/img/profile.jpg",
      // 			"coverPhoto": "public/img/cover.jpg"
      // 		}
      // 	});
      // });

      app.get("/yourpet", function (request, result) {
        result.render("yourpet");
      });
      app.post("/createPet", function (request, result) {
        var accessToken = request.fields.accessToken;
        var petname = request.fields.petname;
        var petdes = request.fields.petdec;
        var petdetail = request.fields.petdetail;
        var coverPhoto = "";

        database.collection("users").findOne(
          {
            accessToken: accessToken,
          },
          function (error, user) {
            if (user == null) {
              result.json({
                status: "error",
                message: "User has been logged out. Please login again.",
              });
            } else {
              if (
                request.files.coverPhoto.size > 0 &&
                request.files.coverPhoto.type.includes("image")
              ) {
                coverPhoto =
                  "public/images/" +
                  new Date().getTime() +
                  "-" +
                  request.files.coverPhoto.name;
                fileSystem.rename(
                  request.files.coverPhoto.path,
                  coverPhoto,
                  function (error) {
                    //
                  }
                );

                database.collection("pets").insertOne(
                  {
                    petname: petname,
                    petdes: petdes,
                    petdetail: petdetail,
                    coverPhoto: coverPhoto,
                    likers: [],
                    user: {
                      _id: user._id,
                      name: user.name,
                      profileImage: user.profileImage,
                    },
                  },
                  function (error, data) {
                    result.json({
                      status: "success",
                      message: "Add pet info success.",
                    });
                  }
                );
              } else {
                result.json({
                  status: "error",
                  message: "Please selct a cover photo.",
                });
              }
            }
          }
        );
      });
    }
  );
});
