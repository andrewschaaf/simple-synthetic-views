API_TOKEN=`cat /dev/urandom | head -c 100 | hexdump | head -n 1 | cut -c 9- | sed "s/ //g" | head -c 32`;
echo 'module.exports = {"api_token":"'$API_TOKEN'"};' > /home/ubuntu/ssv-config.js

sudo apt-get update
sudo apt-get upgrade -y

# chrome (dev)
wget https://dl.google.com/linux/direct/google-chrome-unstable_current_amd64.deb
sudo dpkg -i google-chrome*.deb # this will error (dependencies)
sudo apt-get install -f -y      # install those dependencies
sudo dpkg -i google-chrome*.deb # this should work now
google-chrome -version

# node (8.x)
curl -sL https://deb.nodesource.com/setup_8.x -o /home/ubuntu/nodesource_setup.sh
sudo bash /home/ubuntu/nodesource_setup.sh
sudo apt-get install -y nodejs build-essential
node -v

# postgres (9.5)
sudo apt install -y postgresql
sudo cat /etc/postgresql/9.5/main/pg_hba.conf > /home/ubuntu/pg_hba.conf.backup
sudo bash -c 'cat /home/ubuntu/pg_hba.conf.backup | sed -e 's/peer/trust/g' | sed -e 's/md5/trust/g' > /etc/postgresql/9.5/main/pg_hba.conf'
sudo systemctl restart postgresql.service
echo 'CREATE DATABASE ssv;' | psql -U postgres
cat /vagrant/schema.sql | psql -U postgres ssv

# GNU parallel
wget 'https://launchpadlibrarian.net/188755637/parallel_20141022+ds1-1_all.deb'
sudo dpkg -i parallel_20141022+ds1-1_all.deb

cd /vagrant
npm install

sudo npm install -g pm2
pm2 start /vagrant/server.js -i 1

echo 'Your API token:'
cat /home/ubuntu/ssv-config.js
