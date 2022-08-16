const { CompleteHandler } = require("./utils.js");

exports.handler = async (event) => {
  if (event.detail.queue !== process.env.MEDIA_QUEUE_ARN) {
    console.log("Invalid queue event. Skipping. eventdata = ", event);
    return;
  }

  switch (event.detail.status) {
    case "INPUT_INFORMATION":
      console.log(
        "jobId:" + event.detail.jobId + " Transcoder has read the input info"
      );
      break;

    case "PROGRESSING":
      console.log("jobId:" + event.detail.jobId + " progressing .... ");
      break;

    case "COMPLETE":
      console.log(
        "jobId:" + event.detail.jobId + " successfully completed job."
      );

      console.log("Detail : ", event.detail, "\t type = ", typeof event.detail);
      await CompleteHandler(event.detail.userMetadata);
      break;

    case "ERROR":
      console.log("jobId:" + event.detail.jobId + "ERROR: ", event);
      break;
  }

  return;
};
