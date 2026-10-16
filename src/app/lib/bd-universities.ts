export type UniversityCategory = "Public" | "Private" | "International";

export interface BdUniversity {
  id: string;
  name: string;
  shortName: string;
  category: UniversityCategory;
  domains: string[];
  aliases?: string[];
  logo: string;
}

export const BD_UNIVERSITIES: BdUniversity[] = [
  {
    "id": "du",
    "name": "University of Dhaka",
    "shortName": "DU",
    "category": "Public",
    "domains": [
      "du.ac.bd",
      "univdhaka.edu"
    ],
    "aliases": [],
    "logo": "/images/universities/du.svg"
  },
  {
    "id": "ru",
    "name": "University of Rajshahi",
    "shortName": "RU",
    "category": "Public",
    "domains": [
      "ru.ac.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/ru.svg"
  },
  {
    "id": "cu",
    "name": "University of Chittagong",
    "shortName": "CU",
    "category": "Public",
    "domains": [
      "cu.ac.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/cu.svg"
  },
  {
    "id": "ju",
    "name": "Jahangirnagar University",
    "shortName": "JU",
    "category": "Public",
    "domains": [
      "juniv.edu"
    ],
    "aliases": [],
    "logo": "/images/universities/ju.svg"
  },
  {
    "id": "iu",
    "name": "Islamic University, Bangladesh",
    "shortName": "IU",
    "category": "Public",
    "domains": [
      "iu.ac.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/iu.jpg"
  },
  {
    "id": "ku",
    "name": "Khulna University",
    "shortName": "KU",
    "category": "Public",
    "domains": [
      "ku.ac.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/ku.svg"
  },
  {
    "id": "jnu",
    "name": "Jagannath University",
    "shortName": "JnU",
    "category": "Public",
    "domains": [
      "jnu.ac.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/jnu.svg"
  },
  {
    "id": "cou",
    "name": "Comilla University",
    "shortName": "CoU",
    "category": "Public",
    "domains": [
      "cou.ac.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/cou.png"
  },
  {
    "id": "jkkniu",
    "name": "Jatiya Kabi Kazi Nazrul Islam University",
    "shortName": "JKKNIU",
    "category": "Public",
    "domains": [
      "jkkniu.edu.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/jkkniu.png"
  },
  {
    "id": "bup",
    "name": "Bangladesh University of Professionals (BUP)",
    "shortName": "BUP",
    "category": "Public",
    "domains": [
      "bup.edu.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/bup.svg"
  },
  {
    "id": "brur",
    "name": "Begum Rokeya University",
    "shortName": "BRUR",
    "category": "Public",
    "domains": [
      "brur.ac.bd"
    ],
    "aliases": [
      "Begum Rokeya University, Rangpur"
    ],
    "logo": "/images/universities/brur.svg"
  },
  {
    "id": "bu-barisal",
    "name": "University of Barisal",
    "shortName": "BU",
    "category": "Public",
    "domains": [
      "bu.ac.bd"
    ],
    "aliases": [
      "University of Barishal",
      "Barishal University"
    ],
    "logo": "/images/universities/bu-barisal.svg"
  },
  {
    "id": "rub",
    "name": "Rabindra University, Bangladesh",
    "shortName": "RUB",
    "category": "Public",
    "domains": [
      "rub.ac.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/rub.svg"
  },
  {
    "id": "neu",
    "name": "Netrokona University",
    "shortName": "NEU",
    "category": "Public",
    "domains": [
      "shu.edu.bd",
      "neu.ac.bd"
    ],
    "aliases": [
      "Sheikh Hasina University"
    ],
    "logo": "/images/universities/neu.png"
  },
  {
    "id": "kiu",
    "name": "Kishoreganj University",
    "shortName": "KIU",
    "category": "Public",
    "domains": [
      "bsmru.ac.bd",
      "kiu.ac.bd"
    ],
    "aliases": [
      "Bangabandhu Sheikh Mujibur Rahman University, Kishoreganj"
    ],
    "logo": "/images/universities/kiu.png"
  },
  {
    "id": "mu-bd",
    "name": "Meherpur University",
    "shortName": "MU",
    "category": "Public",
    "domains": [
      "mum.ac.bd"
    ],
    "aliases": [
      "Mujibnagar University"
    ],
    "logo": "/images/universities/mu-bd.png"
  },
  {
    "id": "ub",
    "name": "University of Bogura",
    "shortName": "UB",
    "category": "Public",
    "domains": [
      "ub.ac.bd",
      "bstu.ac.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/ub.jpg"
  },
  {
    "id": "tu-bd",
    "name": "Thakurgaon University",
    "shortName": "TU",
    "category": "Public",
    "domains": [
      "tu.ac.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/tu-bd.png"
  },
  {
    "id": "nau",
    "name": "Naogaon University",
    "shortName": "NAU",
    "category": "Public",
    "domains": [
      "nau.ac.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/nau.svg"
  },
  {
    "id": "sust",
    "name": "Shahjalal University of Science and Technology (SUST)",
    "shortName": "SUST",
    "category": "Public",
    "domains": [
      "sust.edu"
    ],
    "aliases": [],
    "logo": "/images/universities/sust.png"
  },
  {
    "id": "hstu",
    "name": "Hajee Mohammad Danesh Science & Technology University",
    "shortName": "HSTU",
    "category": "Public",
    "domains": [
      "hstu.ac.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/hstu.png"
  },
  {
    "id": "mbstu",
    "name": "Mawlana Bhashani Science and Technology University",
    "shortName": "MBSTU",
    "category": "Public",
    "domains": [
      "mbstu.ac.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/mbstu.png"
  },
  {
    "id": "pstu",
    "name": "Patuakhali Science and Technology University",
    "shortName": "PSTU",
    "category": "Public",
    "domains": [
      "pstu.ac.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/pstu.png"
  },
  {
    "id": "nstu",
    "name": "Noakhali Science and Technology University",
    "shortName": "NSTU",
    "category": "Public",
    "domains": [
      "nstu.edu.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/nstu.png"
  },
  {
    "id": "just",
    "name": "Jashore University of Science and Technology",
    "shortName": "JUST",
    "category": "Public",
    "domains": [
      "just.edu.bd"
    ],
    "aliases": [
      "Jashore University of Science and Technology"
    ],
    "logo": "/images/universities/just.png"
  },
  {
    "id": "pust",
    "name": "Pabna University of Science and Technology",
    "shortName": "PUST",
    "category": "Public",
    "domains": [
      "pust.ac.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/pust.png"
  },
  {
    "id": "gstu",
    "name": "Gopalganj Science and Technology University",
    "shortName": "GSTU",
    "category": "Public",
    "domains": [
      "bsmrstu.edu.bd",
      "gstu.edu.bd"
    ],
    "aliases": [
      "Bangabandhu Sheikh Mujibur Rahman Science and Technology University"
    ],
    "logo": "/images/universities/gstu.png"
  },
  {
    "id": "rmstu",
    "name": "Rangamati Science and Technology University",
    "shortName": "RMSTU",
    "category": "Public",
    "domains": [
      "rmstu.ac.bd",
      "rmstu.edu.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/rmstu.png"
  },
  {
    "id": "jstu",
    "name": "Jamalpur Science and Technology University",
    "shortName": "JSTU",
    "category": "Public",
    "domains": [
      "bsfmstu.ac.bd",
      "jstu.ac.bd"
    ],
    "aliases": [
      "Bangamata Sheikh Fojilatunnesa Mujib Science and Technology University"
    ],
    "logo": "/images/universities/jstu.png"
  },
  {
    "id": "cstu",
    "name": "Chandpur Science and Technology University",
    "shortName": "CSTU",
    "category": "Public",
    "domains": [
      "cstu.ac.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/cstu.png"
  },
  {
    "id": "sstu",
    "name": "Sunamganj Science and Technology University",
    "shortName": "SSTU",
    "category": "Public",
    "domains": [
      "sstu.ac.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/sstu.png"
  },
  {
    "id": "lstu",
    "name": "Lakshmipur Science and Technology University",
    "shortName": "LSTU",
    "category": "Public",
    "domains": [
      "lstu.ac.bd"
    ],
    "aliases": [],
    "logo": ""
  },
  {
    "id": "pstu-pirojpur",
    "name": "Pirojpur Science and Technology University",
    "shortName": "PSTU",
    "category": "Public",
    "domains": [
      "bsmrstup.ac.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/pstu-pirojpur.png"
  },
  {
    "id": "sust-sat",
    "name": "Satkhira University of Science and Technology",
    "shortName": "SUST-S",
    "category": "Public",
    "domains": [
      "sust-satkhira.ac.bd"
    ],
    "aliases": [],
    "logo": ""
  },
  {
    "id": "nstu-ng",
    "name": "Narayanganj Science and Technology University",
    "shortName": "NSTU-N",
    "category": "Public",
    "domains": [
      "nstu-ng.ac.bd"
    ],
    "aliases": [],
    "logo": ""
  },
  {
    "id": "buet",
    "name": "Bangladesh University of Engineering and Technology (BUET)",
    "shortName": "BUET",
    "category": "Public",
    "domains": [
      "buet.ac.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/buet.svg"
  },
  {
    "id": "mist",
    "name": "Military Institute of Science and Technology",
    "shortName": "MIST",
    "category": "Public",
    "domains": [
      "mist.ac.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/mist.svg"
  },
  {
    "id": "ruet",
    "name": "Rajshahi University of Engineering & Technology",
    "shortName": "RUET",
    "category": "Public",
    "domains": [
      "ruet.ac.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/ruet.svg"
  },
  {
    "id": "kuet",
    "name": "Khulna University of Engineering & Technology",
    "shortName": "KUET",
    "category": "Public",
    "domains": [
      "kuet.ac.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/kuet.png"
  },
  {
    "id": "cuet",
    "name": "Chittagong University of Engineering & Technology",
    "shortName": "CUET",
    "category": "Public",
    "domains": [
      "cuet.ac.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/cuet.svg"
  },
  {
    "id": "duet",
    "name": "Dhaka University of Engineering & Technology",
    "shortName": "DUET",
    "category": "Public",
    "domains": [
      "duet.ac.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/duet.png"
  },
  {
    "id": "bau",
    "name": "Bangladesh Agricultural University (BAU)",
    "shortName": "BAU",
    "category": "Public",
    "domains": [
      "bau.edu.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/bau.svg"
  },
  {
    "id": "gau",
    "name": "Gazipur Agricultural University",
    "shortName": "GAU",
    "category": "Public",
    "domains": [
      "gau.edu.bd",
      "bsmrau.edu.bd"
    ],
    "aliases": [
      "Bangabandhu Sheikh Mujibur Rahman Agricultural University",
      "BSMRAU"
    ],
    "logo": "/images/universities/gau.png"
  },
  {
    "id": "sau",
    "name": "Sher-e-Bangla Agricultural University",
    "shortName": "SAU",
    "category": "Public",
    "domains": [
      "sau.edu.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/sau.png"
  },
  {
    "id": "sylhet-au",
    "name": "Sylhet Agricultural University",
    "shortName": "SAU",
    "category": "Public",
    "domains": [
      "sau.ac.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/sylhet-au.jpg"
  },
  {
    "id": "kau",
    "name": "Khulna Agricultural University",
    "shortName": "KAU",
    "category": "Public",
    "domains": [
      "kau.edu.bd",
      "kau.ac.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/kau.svg"
  },
  {
    "id": "hau",
    "name": "Habiganj Agricultural University",
    "shortName": "HAU",
    "category": "Public",
    "domains": [
      "hau.ac.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/hau.png"
  },
  {
    "id": "kuriau",
    "name": "Kurigram Agricultural University",
    "shortName": "KuriAU",
    "category": "Public",
    "domains": [
      "kuriau.edu.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/kuriau.png"
  },
  {
    "id": "shau",
    "name": "Shariatpur Agriculture University",
    "shortName": "ShAU",
    "category": "Public",
    "domains": [
      "shau.ac.bd"
    ],
    "aliases": [],
    "logo": ""
  },
  {
    "id": "bmu",
    "name": "Bangladesh Medical University",
    "shortName": "BMU",
    "category": "Public",
    "domains": [
      "bsmmu.edu.bd",
      "bmu.ac.bd"
    ],
    "aliases": [
      "Bangabandhu Sheikh Mujibur Rahman Medical University",
      "BSMMU"
    ],
    "logo": "/images/universities/bmu.png"
  },
  {
    "id": "cmu",
    "name": "Chittagong Medical University",
    "shortName": "CMU",
    "category": "Public",
    "domains": [
      "cmu.edu.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/cmu.png"
  },
  {
    "id": "rmu-med",
    "name": "Rajshahi Medical University",
    "shortName": "RMU",
    "category": "Public",
    "domains": [
      "rmu.edu.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/rmu-med.png"
  },
  {
    "id": "smu",
    "name": "Sylhet Medical University",
    "shortName": "SMU",
    "category": "Public",
    "domains": [
      "smu.edu.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/smu.png"
  },
  {
    "id": "kmu",
    "name": "Khulna Medical University",
    "shortName": "KMU",
    "category": "Public",
    "domains": [
      "shmu.ac.bd",
      "kmu.ac.bd"
    ],
    "aliases": [
      "Sheikh Hasina Medical University"
    ],
    "logo": "/images/universities/kmu.png"
  },
  {
    "id": "cvasu",
    "name": "Chittagong Veterinary and Animal Sciences University",
    "shortName": "CVASU",
    "category": "Public",
    "domains": [
      "cvasu.ac.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/cvasu.jpg"
  },
  {
    "id": "butex",
    "name": "Bangladesh University of Textiles (BUTEX)",
    "shortName": "BUTEX",
    "category": "Public",
    "domains": [
      "butex.edu.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/butex.svg"
  },
  {
    "id": "bmu-maritime",
    "name": "Bangladesh Maritime University",
    "shortName": "BMU",
    "category": "Public",
    "domains": [
      "bsmrmu.edu.bd",
      "bmu.edu.bd"
    ],
    "aliases": [
      "Bangabandhu Sheikh Mujibur Rahman Maritime University"
    ],
    "logo": "/images/universities/bmu-maritime.png"
  },
  {
    "id": "uftb",
    "name": "University of Frontier Technology, Bangladesh",
    "shortName": "UFTB",
    "category": "Public",
    "domains": [
      "bdu.ac.bd",
      "uftb.ac.bd"
    ],
    "aliases": [
      "Bangabandhu Sheikh Mujibur Rahman Digital University",
      "BDU"
    ],
    "logo": "/images/universities/uftb.svg"
  },
  {
    "id": "aaub",
    "name": "Aviation and Aerospace University Bangladesh",
    "shortName": "AAUB",
    "category": "Public",
    "domains": [
      "bsmraau.edu.bd",
      "aaub.edu.bd"
    ],
    "aliases": [
      "Bangabandhu Sheikh Mujibur Rahman Aviation and Aerospace University"
    ],
    "logo": "/images/universities/aaub.png"
  },
  {
    "id": "nu",
    "name": "National University Bangladesh",
    "shortName": "NU",
    "category": "Public",
    "domains": [
      "nu.ac.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/nu.svg"
  },
  {
    "id": "bou",
    "name": "Bangladesh Open University",
    "shortName": "BOU",
    "category": "Public",
    "domains": [
      "bou.ac.bd",
      "bou.edu.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/bou.svg"
  },
  {
    "id": "iau",
    "name": "Islamic Arabic University",
    "shortName": "IAU",
    "category": "Public",
    "domains": [
      "iau.edu.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/iau.png"
  },
  {
    "id": "dcu",
    "name": "Dhaka Central University",
    "shortName": "DCU",
    "category": "Public",
    "domains": [
      "dcu.ac.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/dcu.svg"
  },
  {
    "id": "iubat",
    "name": "International University of Business Agriculture and Technology",
    "shortName": "IUBAT",
    "category": "Private",
    "domains": [
      "iubat.edu"
    ],
    "aliases": [],
    "logo": "/images/universities/iubat.png"
  },
  {
    "id": "nsu",
    "name": "North South University",
    "shortName": "NSU",
    "category": "Private",
    "domains": [
      "northsouth.edu"
    ],
    "aliases": [],
    "logo": "/images/universities/nsu.svg"
  },
  {
    "id": "iub",
    "name": "Independent University, Bangladesh",
    "shortName": "IUB",
    "category": "Private",
    "domains": [
      "iub.edu.bd",
      "iub.ac.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/iub.svg"
  },
  {
    "id": "aiub",
    "name": "American International University-Bangladesh",
    "shortName": "AIUB",
    "category": "Private",
    "domains": [
      "aiub.edu"
    ],
    "aliases": [],
    "logo": "/images/universities/aiub.svg"
  },
  {
    "id": "diu",
    "name": "Dhaka International University",
    "shortName": "DIU",
    "category": "Private",
    "domains": [
      "diu.ac",
      "diu-bd.net"
    ],
    "aliases": [],
    "logo": "/images/universities/diu.jpg"
  },
  {
    "id": "iiuc",
    "name": "International Islamic University, Chittagong",
    "shortName": "IIUC",
    "category": "Private",
    "domains": [
      "iiuc.ac.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/iiuc.png"
  },
  {
    "id": "aub",
    "name": "Asian University of Bangladesh",
    "shortName": "AUB",
    "category": "Private",
    "domains": [
      "aub.edu.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/aub.jpg"
  },
  {
    "id": "ewu",
    "name": "East West University",
    "shortName": "EWU",
    "category": "Private",
    "domains": [
      "ewubd.edu"
    ],
    "aliases": [],
    "logo": "/images/universities/ewu.png"
  },
  {
    "id": "gb",
    "name": "Gono Bishwabidyalay",
    "shortName": "GB",
    "category": "Private",
    "domains": [
      "gonouniversity.edu.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/gb.png"
  },
  {
    "id": "pub",
    "name": "The People's University of Bangladesh",
    "shortName": "PUB",
    "category": "Private",
    "domains": [
      "pub.ac.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/pub.jpg"
  },
  {
    "id": "queens",
    "name": "Queens University",
    "shortName": "QU",
    "category": "Private",
    "domains": [
      "queensuniversity.edu.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/queens.jpg"
  },
  {
    "id": "uap",
    "name": "University of Asia Pacific",
    "shortName": "UAP",
    "category": "Private",
    "domains": [
      "uap-bd.edu"
    ],
    "aliases": [],
    "logo": "/images/universities/uap.png"
  },
  {
    "id": "ciu",
    "name": "Chittagong Independent University (CIU)",
    "shortName": "CIU",
    "category": "Private",
    "domains": [
      "ciu.edu.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/ciu.jpg"
  },
  {
    "id": "bu",
    "name": "Bangladesh University",
    "shortName": "BU",
    "category": "Private",
    "domains": [
      "bu.edu.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/bu.png"
  },
  {
    "id": "bgctub",
    "name": "BGC Trust University Bangladesh",
    "shortName": "BGCTUB",
    "category": "Private",
    "domains": [
      "bgctub.ac.bd",
      "bgctrustbd.org"
    ],
    "aliases": [],
    "logo": "/images/universities/bgctub.png"
  },
  {
    "id": "bracu",
    "name": "BRAC University",
    "shortName": "BRACU",
    "category": "Private",
    "domains": [
      "bracu.ac.bd"
    ],
    "aliases": [
      "BRAC University"
    ],
    "logo": "/images/universities/bracu.svg"
  },
  {
    "id": "miu",
    "name": "Manarat International University",
    "shortName": "MIU",
    "category": "Private",
    "domains": [
      "manarat.ac.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/miu.jpg"
  },
  {
    "id": "puc",
    "name": "Premier University",
    "shortName": "PUC",
    "category": "Private",
    "domains": [
      "puc.ac.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/puc.png"
  },
  {
    "id": "sub-ctg",
    "name": "Southern University Bangladesh",
    "shortName": "SUB",
    "category": "Private",
    "domains": [
      "southern.ac.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/sub-ctg.png"
  },
  {
    "id": "siu",
    "name": "Sylhet International University",
    "shortName": "SIU",
    "category": "Private",
    "domains": [
      "siu.edu.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/siu.jpg"
  },
  {
    "id": "uoda",
    "name": "University of Development Alternative",
    "shortName": "UODA",
    "category": "Private",
    "domains": [
      "uoda.edu.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/uoda.png"
  },
  {
    "id": "cityuni",
    "name": "City University",
    "shortName": "CityU",
    "category": "Private",
    "domains": [
      "cityuniversity.ac.bd",
      "cityuniversity.edu.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/cityuni.png"
  },
  {
    "id": "diu-daffodil",
    "name": "Daffodil International University",
    "shortName": "DIU",
    "category": "Private",
    "domains": [
      "daffodilvarsity.edu.bd",
      "diu.edu.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/diu-daffodil.svg"
  },
  {
    "id": "gub",
    "name": "Green University of Bangladesh",
    "shortName": "GUB",
    "category": "Private",
    "domains": [
      "green.edu.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/gub.svg"
  },
  {
    "id": "ibais",
    "name": "IBAIS University",
    "shortName": "IBAIS",
    "category": "Private",
    "domains": [
      "ibaisuniv.edu.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/ibais.jpg"
  },
  {
    "id": "lus",
    "name": "Leading University",
    "shortName": "LU",
    "category": "Private",
    "domains": [
      "lus.ac.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/lus.png"
  },
  {
    "id": "nub",
    "name": "Northern University Bangladesh",
    "shortName": "NUB",
    "category": "Private",
    "domains": [
      "nub.ac.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/nub.png"
  },
  {
    "id": "primeuni",
    "name": "Prime University",
    "shortName": "Prime",
    "category": "Private",
    "domains": [
      "primeuniversity.edu.bd",
      "primeuniversity.ac.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/primeuni.png"
  },
  {
    "id": "seu",
    "name": "Southeast University",
    "shortName": "SEU",
    "category": "Private",
    "domains": [
      "seu.edu.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/seu.png"
  },
  {
    "id": "stamford",
    "name": "Stamford University Bangladesh",
    "shortName": "Stamford",
    "category": "Private",
    "domains": [
      "stamforduniversity.edu.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/stamford.svg"
  },
  {
    "id": "sub",
    "name": "State University of Bangladesh",
    "shortName": "SUB",
    "category": "Private",
    "domains": [
      "sub.edu.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/sub.jpg"
  },
  {
    "id": "eu",
    "name": "Eastern University",
    "shortName": "EU",
    "category": "Private",
    "domains": [
      "easternuni.edu.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/eu.svg"
  },
  {
    "id": "metrouni",
    "name": "Metropolitan University",
    "shortName": "MU",
    "category": "Private",
    "domains": [
      "metrouni.edu.bd"
    ],
    "aliases": [
      "Metropolitan University"
    ],
    "logo": "/images/universities/metrouni.svg"
  },
  {
    "id": "tmu",
    "name": "Millennium University",
    "shortName": "TMU",
    "category": "Private",
    "domains": [
      "themillenniumuniversity.edu.bd"
    ],
    "aliases": [
      "The Millennium University"
    ],
    "logo": "/images/universities/tmu.jpg"
  },
  {
    "id": "primeasia",
    "name": "Primeasia University",
    "shortName": "PAU",
    "category": "Private",
    "domains": [
      "primeasia.edu.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/primeasia.png"
  },
  {
    "id": "rud",
    "name": "Royal University of Dhaka",
    "shortName": "RUD",
    "category": "Private",
    "domains": [
      "royal.edu.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/rud.png"
  },
  {
    "id": "uiu",
    "name": "United International University",
    "shortName": "UIU",
    "category": "Private",
    "domains": [
      "uiu.ac.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/uiu.svg"
  },
  {
    "id": "uits",
    "name": "University of Information Technology and Sciences",
    "shortName": "UITS",
    "category": "Private",
    "domains": [
      "uits.edu.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/uits.png"
  },
  {
    "id": "usa-bd",
    "name": "University of South Asia",
    "shortName": "UniSA",
    "category": "Private",
    "domains": [
      "southasiauni.ac.bd",
      "unisa.ac.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/usa-bd.jpg"
  },
  {
    "id": "pu-bd",
    "name": "Presidency University",
    "shortName": "PU",
    "category": "Private",
    "domains": [
      "pu.edu.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/pu-bd.svg"
  },
  {
    "id": "uu",
    "name": "Uttara University",
    "shortName": "UU",
    "category": "Private",
    "domains": [
      "uttarauniversity.edu.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/uu.svg"
  },
  {
    "id": "vub",
    "name": "Victoria University of Bangladesh",
    "shortName": "VUB",
    "category": "Private",
    "domains": [
      "vub.edu.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/vub.png"
  },
  {
    "id": "wub",
    "name": "World University of Bangladesh",
    "shortName": "WUB",
    "category": "Private",
    "domains": [
      "wub.edu.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/wub.jpg"
  },
  {
    "id": "asaub",
    "name": "Asa University Bangladesh",
    "shortName": "ASAUB",
    "category": "Private",
    "domains": [
      "asaub.edu.bd"
    ],
    "aliases": [
      "ASA University Bangladesh"
    ],
    "logo": "/images/universities/asaub.jpg"
  },
  {
    "id": "biu",
    "name": "Bangladesh Islami University",
    "shortName": "BIU",
    "category": "Private",
    "domains": [
      "biu.ac.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/biu.png"
  },
  {
    "id": "edu",
    "name": "East Delta University",
    "shortName": "EDU",
    "category": "Private",
    "domains": [
      "eastdelta.edu.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/edu.png"
  },
  {
    "id": "nubtk",
    "name": "Northern University of Business and Technology Khulna",
    "shortName": "NUBTK",
    "category": "Private",
    "domains": [
      "nubtkhulna.ac.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/nubtk.png"
  },
  {
    "id": "britannia",
    "name": "Britannia University",
    "shortName": "BU",
    "category": "Private",
    "domains": [
      "britannia.edu.bd",
      "britannia.ac"
    ],
    "aliases": [],
    "logo": "/images/universities/britannia.png"
  },
  {
    "id": "feniuni",
    "name": "Feni University",
    "shortName": "FU",
    "category": "Private",
    "domains": [
      "feniuniversity.ac.bd",
      "feniuniversity.edu.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/feniuni.jpg"
  },
  {
    "id": "kyau",
    "name": "Khwaja Yunus Ali University",
    "shortName": "KYAU",
    "category": "Private",
    "domains": [
      "kyau.edu.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/kyau.png"
  },
  {
    "id": "eub",
    "name": "European University of Bangladesh",
    "shortName": "EUB",
    "category": "Private",
    "domains": [
      "eub.edu.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/eub.png"
  },
  {
    "id": "fcub",
    "name": "First Capital University Of Bangladesh",
    "shortName": "FCUB",
    "category": "Private",
    "domains": [
      "fcub.edu.bd"
    ],
    "aliases": [
      "First Capital University of Bangladesh"
    ],
    "logo": "/images/universities/fcub.jpg"
  },
  {
    "id": "buft",
    "name": "BGMEA University of Fashion & Technology",
    "shortName": "BUFT",
    "category": "Private",
    "domains": [
      "buft.edu.bd"
    ],
    "aliases": [
      "BGMEA University of Fashion and Technology"
    ],
    "logo": "/images/universities/buft.png"
  },
  {
    "id": "hub",
    "name": "Hamdard University Bangladesh",
    "shortName": "HUB",
    "category": "Private",
    "domains": [
      "hamdarduniversity.edu.bd",
      "hamdarduniversitybd.org"
    ],
    "aliases": [],
    "logo": "/images/universities/hub.jpg"
  },
  {
    "id": "iiub",
    "name": "Ishakha International University",
    "shortName": "IIUB",
    "category": "Private",
    "domains": [
      "ishakha.edu.bd"
    ],
    "aliases": [
      "Ishakha International University, Bangladesh"
    ],
    "logo": "/images/universities/iiub.jpg"
  },
  {
    "id": "neub",
    "name": "North East University Bangladesh",
    "shortName": "NEUB",
    "category": "Private",
    "domains": [
      "neub.edu.bd"
    ],
    "aliases": [
      "North East University Bangladesh"
    ],
    "logo": "/images/universities/neub.jpg"
  },
  {
    "id": "nwu",
    "name": "North Western University, Bangladesh",
    "shortName": "NWU",
    "category": "Private",
    "domains": [
      "nwu.edu.bd"
    ],
    "aliases": [
      "North Western University"
    ],
    "logo": "/images/universities/nwu.png"
  },
  {
    "id": "pciu",
    "name": "Port City International University",
    "shortName": "PCIU",
    "category": "Private",
    "domains": [
      "portcity.edu.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/pciu.png"
  },
  {
    "id": "vu",
    "name": "Varendra University",
    "shortName": "VU",
    "category": "Private",
    "domains": [
      "vu.edu.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/vu.jpg"
  },
  {
    "id": "su",
    "name": "Sonargaon University",
    "shortName": "SU",
    "category": "Private",
    "domains": [
      "su.edu.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/su.png"
  },
  {
    "id": "cbiu",
    "name": "Cox's Bazar International University",
    "shortName": "CBIU",
    "category": "Private",
    "domains": [
      "cbiu.ac.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/cbiu.jpg"
  },
  {
    "id": "fiu",
    "name": "Fareast International University",
    "shortName": "FIU",
    "category": "Private",
    "domains": [
      "fiu.edu.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/fiu.png"
  },
  {
    "id": "gub-german",
    "name": "German University Bangladesh",
    "shortName": "GUB",
    "category": "Private",
    "domains": [
      "gub.edu.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/gub-german.jpg"
  },
  {
    "id": "nbiu",
    "name": "North Bengal International University",
    "shortName": "NBIU",
    "category": "Private",
    "domains": [
      "nbiu.edu.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/nbiu.png"
  },
  {
    "id": "ndub",
    "name": "Notre Dame University Bangladesh",
    "shortName": "NDUB",
    "category": "Private",
    "domains": [
      "ndub.edu.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/ndub.svg"
  },
  {
    "id": "rpsu",
    "name": "Ranada Prasad Shaha University",
    "shortName": "RPSU",
    "category": "Private",
    "domains": [
      "rpsu.edu.bd"
    ],
    "aliases": [
      "R.P. Shaha University"
    ],
    "logo": "/images/universities/rpsu.jpg"
  },
  {
    "id": "biu-brahma",
    "name": "Brahmaputra International University",
    "shortName": "BIU",
    "category": "Private",
    "domains": [
      "brahmaputra.ac.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/biu-brahma.png"
  },
  {
    "id": "times",
    "name": "Times University Bangladesh",
    "shortName": "TUB",
    "category": "Private",
    "domains": [
      "timesuniversitybd.com",
      "times.ac.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/times.png"
  },
  {
    "id": "cub",
    "name": "Canadian University of Bangladesh",
    "shortName": "CUB",
    "category": "Private",
    "domains": [
      "cub.edu.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/cub.png"
  },
  {
    "id": "global",
    "name": "Global University Bangladesh",
    "shortName": "GUB",
    "category": "Private",
    "domains": [
      "globaluniversity.edu.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/global.png"
  },
  {
    "id": "npiub",
    "name": "NPI University of Bangladesh",
    "shortName": "NPIUB",
    "category": "Private",
    "domains": [
      "npiub.edu.bd"
    ],
    "aliases": [
      "N.P.I. University of Bangladesh"
    ],
    "logo": "/images/universities/npiub.png"
  },
  {
    "id": "rmu",
    "name": "Rabindra Maitree University",
    "shortName": "RMU",
    "category": "Private",
    "domains": [
      "rmu.ac.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/rmu.jpg"
  },
  {
    "id": "ius",
    "name": "University of Scholars",
    "shortName": "IUS",
    "category": "Private",
    "domains": [
      "ius.edu.bd"
    ],
    "aliases": [
      "The International University of Scholars",
      "International University of Scholars"
    ],
    "logo": "/images/universities/ius.png"
  },
  {
    "id": "uctc",
    "name": "University of Creative Technology Chittagong",
    "shortName": "UCTC",
    "category": "Private",
    "domains": [
      "uctc.edu.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/uctc.png"
  },
  {
    "id": "akmu",
    "name": "Anwer Khan Modern University",
    "shortName": "AKMU",
    "category": "Private",
    "domains": [
      "akmu.edu.bd"
    ],
    "aliases": [
      "Anwer Khan Modern University"
    ],
    "logo": "/images/universities/akmu.png"
  },
  {
    "id": "ugv",
    "name": "University of Global Village",
    "shortName": "UGV",
    "category": "Private",
    "domains": [
      "ugv.edu.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/ugv.png"
  },
  {
    "id": "kkbau",
    "name": "Khulna Khan Bahadur Ahsanullah University",
    "shortName": "KKBAU",
    "category": "Private",
    "domains": [
      "kkbau.ac.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/kkbau.png"
  },
  {
    "id": "tub",
    "name": "Trust University, Barishal",
    "shortName": "TUB",
    "category": "Private",
    "domains": [
      "trustuniversity.edu.bd"
    ],
    "aliases": [
      "Trust University, Barishal"
    ],
    "logo": "/images/universities/tub.jpg"
  },
  {
    "id": "uob",
    "name": "University of Brahmanbaria",
    "shortName": "UOB",
    "category": "Private",
    "domains": [
      "uob.edu.bd"
    ],
    "aliases": [
      "University of Brahmanbaria"
    ],
    "logo": "/images/universities/uob.png"
  },
  {
    "id": "uset",
    "name": "University of Skill Enrichment and Technology",
    "shortName": "USET",
    "category": "Private",
    "domains": [
      "uset.edu.bd"
    ],
    "aliases": [
      "University of Skill Enrichment and Technology"
    ],
    "logo": ""
  },
  {
    "id": "isu",
    "name": "International Standard University",
    "shortName": "ISU",
    "category": "Private",
    "domains": [
      "isu.ac.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/isu.png"
  },
  {
    "id": "zums",
    "name": "ZNRF University of Management Sciences",
    "shortName": "ZUMS",
    "category": "Private",
    "domains": [
      "zums.edu.bd"
    ],
    "aliases": [
      "ZNRF University of Management Sciences"
    ],
    "logo": "/images/universities/zums.png"
  },
  {
    "id": "bandarban",
    "name": "Bandarban University",
    "shortName": "BU",
    "category": "Private",
    "domains": [
      "bubd.edu.bd",
      "bubban.edu.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/bandarban.jpg"
  },
  {
    "id": "rtm-aktu",
    "name": "RTM Al-Kabir Technical University",
    "shortName": "RTM-AKTU",
    "category": "Private",
    "domains": [
      "rtm-aktu.edu.bd"
    ],
    "aliases": [
      "RTM Al-Kabir Technical University"
    ],
    "logo": "/images/universities/rtm-aktu.png"
  },
  {
    "id": "iiustb",
    "name": "International Islami University of Science and Technology Bangladesh",
    "shortName": "IIUSTB",
    "category": "Private",
    "domains": [
      "iiustb.ac.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/iiustb.png"
  },
  {
    "id": "microland",
    "name": "Microland University of Science and Technology",
    "shortName": "MUST",
    "category": "Private",
    "domains": [
      "microlanduniversity.org"
    ],
    "aliases": [],
    "logo": "/images/universities/microland.png"
  },
  {
    "id": "lusa",
    "name": "Lalon University of Science & Arts",
    "shortName": "LUSA",
    "category": "Private",
    "domains": [
      "lusa.ac.bd",
      "lusabd.org"
    ],
    "aliases": [
      "Lalon University of Science & Arts"
    ],
    "logo": "/images/universities/lusa.png"
  },
  {
    "id": "grameen",
    "name": "Grameen University",
    "shortName": "GU",
    "category": "Private",
    "domains": [
      "grameenuniversity.edu.bd",
      "grameenu.ac"
    ],
    "aliases": [],
    "logo": "/images/universities/grameen.png"
  },
  {
    "id": "ustc",
    "name": "University of Science and Technology Chittagong",
    "shortName": "USTC",
    "category": "Private",
    "domains": [
      "ustc.ac.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/ustc.png"
  },
  {
    "id": "aust",
    "name": "Ahsanullah University of Science and Technology",
    "shortName": "AUST",
    "category": "Private",
    "domains": [
      "aust.edu"
    ],
    "aliases": [],
    "logo": "/images/universities/aust.svg"
  },
  {
    "id": "pust-bd",
    "name": "Pundra University of Science and Technology",
    "shortName": "PUST",
    "category": "Private",
    "domains": [
      "pundrauniversity.ac.bd"
    ],
    "aliases": [
      "PDUST"
    ],
    "logo": "/images/universities/pust-bd.jpg"
  },
  {
    "id": "bubt",
    "name": "Bangladesh University of Business and Technology",
    "shortName": "BUBT",
    "category": "Private",
    "domains": [
      "bubt.edu.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/bubt.png"
  },
  {
    "id": "adust",
    "name": "Atish Dipankar University of Science and Technology",
    "shortName": "ADUST",
    "category": "Private",
    "domains": [
      "adust.edu.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/adust.jpg"
  },
  {
    "id": "zhsust",
    "name": "ZH Sikder University of Science & Technology",
    "shortName": "ZHSUST",
    "category": "Private",
    "domains": [
      "zhsust.ac.bd",
      "zhsust.edu.bd"
    ],
    "aliases": [
      "Z.H. Sikder University of Science and Technology"
    ],
    "logo": "/images/universities/zhsust.png"
  },
  {
    "id": "rstu",
    "name": "Rajshahi Science & Technology University",
    "shortName": "RSTU",
    "category": "Private",
    "domains": [
      "rstu.edu.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/rstu.jpg"
  },
  {
    "id": "baiust",
    "name": "Bangladesh Army International University of Science & Technology",
    "shortName": "BAIUST",
    "category": "Private",
    "domains": [
      "baiust.ac.bd",
      "baiust.edu.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/baiust.png"
  },
  {
    "id": "baust-khulna",
    "name": "Bangladesh Army University of Science & Technology, Khulna",
    "shortName": "BAUST-K",
    "category": "Private",
    "domains": [
      "baustkhulna.ac.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/baust-khulna.svg"
  },
  {
    "id": "baust",
    "name": "Bangladesh Army University of Science and Technology, Saidpur",
    "shortName": "BAUST",
    "category": "Private",
    "domains": [
      "baust.edu.bd"
    ],
    "aliases": [
      "Bangladesh Army University of Science and Technology"
    ],
    "logo": "/images/universities/baust.png"
  },
  {
    "id": "ccnust",
    "name": "CCN University of Science & Technology",
    "shortName": "CCNUST",
    "category": "Private",
    "domains": [
      "ccnust.ac.bd",
      "ccnust.edu.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/ccnust.jpg"
  },
  {
    "id": "cust",
    "name": "Central University of Science and Technology",
    "shortName": "CUST",
    "category": "Private",
    "domains": [
      "cust.edu.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/cust.png"
  },
  {
    "id": "dmust",
    "name": "Dr. Momtaz Begum University of Science and Technology",
    "shortName": "MUST",
    "category": "Private",
    "domains": [
      "must.ac.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/dmust.jpg"
  },
  {
    "id": "cwu",
    "name": "Central Women's University",
    "shortName": "CWU",
    "category": "Private",
    "domains": [
      "cwu.edu.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/cwu.jpg"
  },
  {
    "id": "smuct",
    "name": "Shanto-Mariam University of Creative Technology",
    "shortName": "SMUCT",
    "category": "Private",
    "domains": [
      "smuct.ac.bd",
      "smuct.edu.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/smuct.png"
  },
  {
    "id": "ulab",
    "name": "University of Liberal Arts Bangladesh",
    "shortName": "ULAB",
    "category": "Private",
    "domains": [
      "ulab.edu.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/ulab.svg"
  },
  {
    "id": "buhs",
    "name": "Bangladesh University of Health Sciences (BUHS)",
    "shortName": "BUHS",
    "category": "Private",
    "domains": [
      "buhs.ac.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/buhs.png"
  },
  {
    "id": "ebaub",
    "name": "Exim Bank Agricultural University Bangladesh",
    "shortName": "EBAUB",
    "category": "Private",
    "domains": [
      "ebaub.edu.bd"
    ],
    "aliases": [],
    "logo": ""
  },
  {
    "id": "bauet",
    "name": "Bangladesh Army University of Engineering & Technology",
    "shortName": "BAUET",
    "category": "Private",
    "domains": [
      "bauet.ac.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/bauet.jpg"
  },
  {
    "id": "tuca",
    "name": "Tagore University of Creative Arts",
    "shortName": "TUCA",
    "category": "Private",
    "domains": [
      "tuca.edu.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/tuca.png"
  },
  {
    "id": "iut",
    "name": "Islamic University of Technology",
    "shortName": "IUT",
    "category": "International",
    "domains": [
      "iut-dhaka.edu",
      "iutoic-dhaka.edu"
    ],
    "aliases": [
      "Islamic University of Technology (IUT)"
    ],
    "logo": "/images/universities/iut.png"
  },
  {
    "id": "auw",
    "name": "Asian University for Women",
    "shortName": "AUW",
    "category": "International",
    "domains": [
      "auw.edu.bd"
    ],
    "aliases": [
      "Asian University for Women (AUW)"
    ],
    "logo": "/images/universities/auw.png"
  },
  {
    "id": "amust",
    "name": "Ahsania Mission University of Science and Technology",
    "shortName": "AMUST",
    "category": "Private",
    "domains": [
      "amust.ac.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/amust.png"
  },
  {
    "id": "sfmu",
    "name": "Sheikh Fazilatunnesa Mujib University",
    "shortName": "SFMU",
    "category": "Private",
    "domains": [
      "sfmu.edu.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/sfmu.png"
  },
  {
    "id": "smmu",
    "name": "Shah Makhdum Management University",
    "shortName": "SMMU",
    "category": "Private",
    "domains": [
      "smmu.edu.bd"
    ],
    "aliases": [],
    "logo": ""
  },
  {
    "id": "cbuft",
    "name": "Chattogram BGMEA University of Fashion and Technology",
    "shortName": "CBUFT",
    "category": "Private",
    "domains": [
      "cbuft.edu.bd"
    ],
    "aliases": [],
    "logo": "/images/universities/cbuft.png"
  },
  {
    "id": "sau-int",
    "name": "South Asian University",
    "shortName": "SAU",
    "category": "International",
    "domains": [
      "sau.int"
    ],
    "aliases": [],
    "logo": "/images/universities/sau-int.png"
  }
];

export function matchesUniversityEmail(
  email: string,
  university: BdUniversity
): boolean {
  const parts = email.trim().toLowerCase().split("@");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return false;
  const domainPart = parts[1];
  return university.domains.some(
    (d) => domainPart === d || domainPart.endsWith(`.${d}`)
  );
}
