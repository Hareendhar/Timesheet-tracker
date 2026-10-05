const KEKA_TOKEN_URL = "https://login.keka.com/connect/token";
const KEKA_BASE_URL = "https://versatilemobitech.keka.com";

async function getKekaAccessToken() {
  const body = new URLSearchParams({
    grant_type: "kekaapi",
    scope: "kekaapi",
    client_id: process.env.KEKA_CLIENT_ID,
    client_secret: process.env.KEKA_CLIENT_SECRET,
    api_key: process.env.KEKA_API_KEY,
  });

  const response = await fetch(KEKA_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "Mozilla/5.0",
    },
    body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Keka token request failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();

  if (!data.access_token) {
    throw new Error("Keka token response did not contain an access_token");
  }

  return data.access_token;
}

async function getKekaAttendance(from, to, pageSize = 100) {
  const accessToken = await getKekaAccessToken();

  const allRecords = [];
  let pageNumber = 1;
  let totalPages = 1;

  while (pageNumber <= totalPages) {
    console.log(`Fetching Keka attendance page ${pageNumber}...`);

    const url = new URL(`${KEKA_BASE_URL}/api/v1/time/attendance`);
    url.searchParams.set("from", from);
    url.searchParams.set("to", to);
    url.searchParams.set("pageNumber", pageNumber);
    url.searchParams.set("pageSize", pageSize);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0",
      }, 
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Keka attendance request failed (${response.status}): ${errorText}`
      );
    }

    const data = await response.json();

    // console.log(
    //   "RAW KEKA ATTENDANCE ALL:",
    //   JSON.stringify(data.data, null, 2)
    // );

    const vm0373Record = data.data?.find(
      (record) => record.employeeNumber === "VM0373"
    );

    console.log(
      "RAW VM0373:",
      JSON.stringify(vm0373Record, null, 2)
    );

    if (Array.isArray(data.data)) {
      allRecords.push(...data.data);
    }

    if (vm0373Record) {
  console.log(
    "VM0373 KEKA KEYS:",
    Object.keys(vm0373Record)
  );
}

    totalPages = Number(data.totalPages) || 1;
    pageNumber++;
  }

  return {
    data: allRecords,
    totalRecords: allRecords.length,
    totalPages,
  };
}


async function getKekaWFH(from, to, employeeId) {
  const accessToken = await getKekaAccessToken();

  const url = new URL(`${KEKA_BASE_URL}/api/v1/time/wfh`);

  url.searchParams.set("from", from);
  url.searchParams.set("to", to);

  if (employeeId) {
    url.searchParams.set("employeeIds", employeeId);
  }

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      `Keka WFH request failed (${response.status}): ${errorText}`
    );
  }

  return await response.json();
}



async function getKekaCaptureScheme() {
  const accessToken = await getKekaAccessToken();

  const url = new URL(
    `${KEKA_BASE_URL}/api/v1/time/capturescheme`
  );

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      `Keka capture scheme request failed (${response.status}): ${errorText}`
    );
  }

  return await response.json();
}

module.exports = {
  getKekaAccessToken,
  getKekaAttendance,
  getKekaWFH,
  getKekaCaptureScheme,
};