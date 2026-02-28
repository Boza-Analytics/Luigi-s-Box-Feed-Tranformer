const axios = require('axios');
const xml2js = require('xml2js');

module.exports = async (req, res) => {
  try {
    // 1. Stáhnout původní XML
    const response = await axios.get('https://www.dops.cz/editor/filestore/io_folder/luigisbox.xml');
    const parser = new xml2js.Parser({ explicitArray: true });
    const result = await parser.parseStringPromise(response.data);

    const shopItems = result.SHOP.SHOPITEM;
    
    // 2. Transformace položek
    const transformedItems = shopItems.map(item => {
      // Vyčištění kategorií (získání té nejdelší/nejdetailnější cesty)
      let categories = item.CATEGORYTEXT || [];
      // Odstranění duplicit a krátkých cest, pokud existuje delší verze
      let bestCategory = "";
      if (categories.length > 0) {
        // Seřadíme od nejdelšího řetězce a vezmeme ten s "|"
        bestCategory = categories.sort((a, b) => b.length - a.length)[0];
      }

      return {
        identity: item.ID[0],
        title: item.PRODUCTNAME ? item.PRODUCTNAME[0] : item.PRODUCT[0],
        web_url: item.URL[0],
        price: `${item.PRICE_VAT[0]} Kč`,
        availability: item.AVAILABILITY[0],
        image_link_l: item.IMGURL[0],
        description: item.DESCRIPTION ? item.DESCRIPTION[0] : "",
        ean: item.EAN ? item.EAN[0] : "",
        brand: item.MANUFACTURER && item.MANUFACTURER[0] !== "" ? item.MANUFACTURER[0] : "",
        category: {
          $: { primary: "true" },
          _: bestCategory
        }
      };
    });

    // 3. Sestavení nového XML
    const builder = new xml2js.Builder({
      rootName: 'items',
      cdata: true
    });

    const finalXml = builder.buildObject({ item: transformedItems });

    // 4. Odeslání odpovědi
    res.setHeader('Content-Type', 'application/xml');
    res.status(200).send(finalXml);
    
  } catch (error) {
    console.error(error);
    res.status(500).send('Error transforming feed');
  }
};
