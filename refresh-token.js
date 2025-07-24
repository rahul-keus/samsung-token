const axios = require('axios');
require('dotenv').config();

async function refreshAccessToken(refreshToken, clientId, clientSecret) {
    try {
        const params = new URLSearchParams();
        params.append('grant_type', 'refresh_token');
        params.append('refresh_token', refreshToken);

        const response = await axios.post('https://auth-global.api.smartthings.com/oauth/token',
            params,
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
                }
            }
        );
        return response.data;
    } catch (error) {
        console.error('Error refreshing token:', error.response?.data || error.message);
        throw error;
    }
}

// Example usage
async function main() {
    const refreshToken = process.env.SMARTTHINGS_REFRESH_TOKEN;
    const clientId = process.env.SMARTTHINGS_CLIENT_ID;
    const clientSecret = process.env.SMARTTHINGS_CLIENT_SECRET;

    try {
        const tokens = await refreshAccessToken(refreshToken, clientId, clientSecret);
        console.log("--------------------------------");
        console.log(tokens);
        console.log("--------------------------------");
    } catch (error) {
        console.error('Failed to refresh token');
    }
}

// Export the function for use in other files
module.exports = {
    refreshAccessToken
};

// Run the example if this file is run directly
if (require.main === module) {
    main();
}
