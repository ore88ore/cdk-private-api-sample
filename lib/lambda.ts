export const handler = async (event: any): Promise<any> => {
  const responseBody = {
    "message": "Private API executed!!"
  };
  return {
    statusCode: "200",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(responseBody),
  };
};
