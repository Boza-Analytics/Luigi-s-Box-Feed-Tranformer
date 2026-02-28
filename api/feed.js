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
      // Vyčištění kategorií
      let categories = item.CATEGORYTEXT || [];
      let bestCategory = "";
      if (categories.length > 0) {
        bestCategory = categories.sort((a, b) => b.length - a.length)[0];
      }

      // Logika dostupnosti: 1 = skladem, 15 = nedostupné (pro Luigi's Box ranking)
      // Kontrolujeme, zda je v AVAILABILITY "1" nebo číslo 1
      const isAvailable = item.AVAILABILITY && (item.AVAILABILITY[0] === "1" || item.AVAILABILITY[0] === 1);

      return {
        identity: item.ID[0],
        title: item.PRODUCTNAME ? item.PRODUCTNAME[0] : item.PRODUCT[0],
        web_url: item.URL[0],
        price: `${item.PRICE_VAT[0]} Kč`,
        // Oprava chyby: posíláme ranky, které LB lépe chápe
        availability: isAvailable ? 1 : 0,
        availability_rank: isAvailable ? 1 : 15,
        availability_rank_text: isAvailable ? "Skladem" : "Není skladem",
        image_link_l: item.IMGURL ? item.IMGURL[0] : "",
        description: item.DESCRIPTION ? item.DESCRIPTION[0] : "",
        ean: item.EAN ? item.EAN[0] : "",
        // Pokud je výrobce prázdný, LB to prostě ignoruje
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
      cdata: true // Obalí texty do CDATA sekcí
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
